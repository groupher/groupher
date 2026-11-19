defmodule GroupherServer.CMS.Assets.Deletion do
  @moduledoc """
  Notifies assets-hub to remove provider objects after Phoenix marks an asset deleted.

  Phoenix remains the business lifecycle authority. This module only sends a
  best-effort cleanup request to assets-hub; failures must not make a deleted
  asset readable again.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Deletion
        -> Repo / Assets Hub
  """

  use Tesla

  require Logger
  require GroupherServer.CMS.Assets.ErrorCat

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Assets.{Effects, ErrorCat, Persist, Workflow}
  alias CMS.Model.{AssetWorkflowRun, Community, CommunityApplicationLogoUpload, CommunityAsset}
  alias CMS.Outbox.DedupeKey

  @timeout 10_000

  plug(Tesla.Middleware.JSON, engine: Jason)
  plug(Tesla.Middleware.Timeout, timeout: @timeout)

  @doc "Checks the frozen provider target before both recovery and external delivery."
  def provider_delete_target(
        %{
          event: "asset.provider_delete",
          resource_type: "community_asset"
        } = event
      ) do
    case load_provider_target(CommunityAsset, event.resource_id) do
      %CommunityAsset{status: :deleted, deleted_at: %DateTime{}} = asset ->
        if target_matches?(event, asset, "asset_id") do
          {:ok, asset}
        else
          {:error, ErrorCat.provider_delete_target_invalid()}
        end

      _ ->
        {:error, ErrorCat.provider_delete_target_invalid()}
    end
  end

  def provider_delete_target(
        %{
          event: "asset.application_upload_provider_delete",
          resource_type: "application_logo_upload"
        } = event
      ) do
    case load_provider_target(CommunityApplicationLogoUpload, event.resource_id) do
      %CommunityApplicationLogoUpload{status: :expired} = upload ->
        if target_matches?(event, upload, "id") do
          {:ok,
           %CommunityAsset{
             id: upload.id,
             public_ref: upload.public_ref,
             storage: upload.storage,
             storage_key: upload.storage_key
           }}
        else
          {:error, ErrorCat.provider_delete_target_invalid()}
        end

      _ ->
        {:error, ErrorCat.provider_delete_target_invalid()}
    end
  end

  def provider_delete_target(%{resource_type: resource_type})
      when resource_type not in ["community_asset", "application_logo_upload"] do
    {:error, ErrorCat.unsupported_asset_cleanup_resource(%{resource_type: resource_type})}
  end

  def provider_delete_target(_event), do: {:error, ErrorCat.provider_delete_target_invalid()}

  defp target_matches?(event, target, id_field) do
    event.worker == "GroupherServer.Jobs.CMSOutboxAsset" and
      event.data[id_field] == target.id and event.data["public_ref"] == target.public_ref and
      event.data["storage"] == target.storage and event.data["storage_key"] == target.storage_key and
      event.dedupe_key ==
        DedupeKey.encode([target.public_ref, target.storage, target.storage_key]) and
      is_binary(target.storage) and target.storage != "" and
      is_binary(target.storage_key) and target.storage_key != ""
  end

  defp load_provider_target(schema, resource_id) do
    case Ecto.Type.cast(:id, resource_id) do
      {:ok, id} ->
        query = from(row in schema, where: row.id == ^id)
        Repo.one(query)

      :error ->
        nil
    end
  end

  @doc "Builds the provider-deletion projection for an expired Application upload."
  @spec delete_application_upload_object(map()) :: {:ok, :pass}
  def delete_application_upload_object(upload) do
    workflow_ref = "application-upload-cleanup:#{upload.id}"
    owner = "application-upload-cleanup:#{Ecto.UUID.generate()}"

    with {:ok, run} <-
           Workflow.ensure_run(%{
             workflow_ref: workflow_ref,
             workflow_type: "application_upload_cleanup",
             resource_type: "application_logo_upload",
             resource_id: to_string(upload.id),
             status: :pending
           }),
         {:ok, step} <-
           Workflow.ensure_step(run, %{
             step_ref: "upload:#{upload.id}",
             resource_type: "application_logo_upload",
             resource_id: to_string(upload.id),
             status: :pending,
             payload: %{upload_id: upload.id, public_ref: upload.public_ref},
             result: %{},
             attempts: 0
           }),
         {:ok, claimed} <- Workflow.claim_step(step, owner),
         {:ok, :pass} <- enqueue_application_upload(claimed, upload, owner) do
      {:ok, :pass}
    else
      {:completed, _step} -> {:ok, :pass}
      {:busy, seconds} -> {:error, {:workflow_step_busy, seconds}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp enqueue_application_upload(claimed, upload, owner) do
    Repo.transact_result(fn ->
      with {:ok, _event} <-
             Effects.enqueue_application_upload_delete(upload, claimed.operation_ref),
           {:ok, _step} <- Workflow.complete_step(claimed, owner, %{"outbox" => "created"}) do
        {:ok, :pass}
      end
    end)
  end

  @doc "Soft-deletes generated assets and enqueues provider cleanup."
  @spec delete_generated_assets(Community.t(), [String.t()], keyword()) :: {:ok, :pass}
  def delete_generated_assets(%Community{id: community_id} = community, public_refs, opts \\ [])
      when is_list(public_refs) and is_list(opts) do
    public_refs = Enum.filter(public_refs, &is_binary/1)

    workflow_ref =
      Keyword.get(opts, :workflow_ref, retention_workflow_ref(community_id, public_refs))

    assets =
      from(asset in CommunityAsset,
        where:
          asset.community_id == ^community_id and asset.public_ref in ^public_refs and
            is_nil(asset.deleted_at)
      )
      |> Repo.all()

    with {:ok, run} <-
           Workflow.ensure_run(%{
             workflow_ref: workflow_ref,
             workflow_type: "generated_asset_cleanup",
             community_id: community_id,
             resource_type: "community",
             resource_id: to_string(community_id),
             status: :pending
           }),
         owner <- "generated-asset-cleanup:#{workflow_ref}:#{Ecto.UUID.generate()}",
         {:ok, run_state} <- Workflow.claim_run(run, owner),
         {:ok, steps} <- ensure_deletion_steps(run, assets),
         {first_error, _processed} <-
           process_deletion_steps(steps, community, workflow_ref, owner),
         {:ok, _finished} <- Workflow.finish_run(run_state, owner) do
      case first_error do
        nil -> {:ok, :pass}
        reason -> {:error, reason}
      end
    else
      {:completed, _run} -> {:ok, :pass}
      {:busy, seconds} -> {:error, {:workflow_busy, seconds}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_deletion_steps(%AssetWorkflowRun{} = run, assets) do
    Enum.reduce_while(assets, {:ok, []}, fn asset, {:ok, steps} ->
      case Workflow.ensure_step(run, %{
             step_ref: "asset:#{asset.id}",
             resource_type: "community_asset",
             resource_id: to_string(asset.id),
             status: :pending,
             payload: %{asset_id: asset.id, public_ref: asset.public_ref},
             result: %{},
             attempts: 0
           }) do
        {:ok, step} -> {:cont, {:ok, [step | steps]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, steps} -> {:ok, Enum.reverse(steps)}
      error -> error
    end
  end

  defp process_deletion_steps(steps, community, _workflow_ref, owner) do
    Enum.reduce(steps, {nil, 0}, fn step, {first_error, processed} ->
      case Workflow.claim_step(step, owner) do
        {:completed, _step} ->
          {first_error, processed + 1}

        {:busy, seconds} ->
          {first_error || {:workflow_step_busy, seconds}, processed}

        {:ok, claimed} ->
          case delete_one_generated_asset(community, claimed) do
            {:ok, :pass} ->
              _ = Workflow.complete_step(claimed, owner, %{"status" => "deleted"})
              {first_error, processed + 1}

            {:error, reason} ->
              _ = Workflow.fail_step(claimed, owner, reason)
              {first_error || reason, processed + 1}
          end
      end
    end)
  end

  defp delete_one_generated_asset(community, claimed) do
    Repo.transaction(fn ->
      with {:ok, deleted} <- Persist.delete(community, claimed.resource_id),
           {:ok, _event} <-
             Effects.enqueue_provider_delete(deleted, claimed.operation_ref) do
        :pass
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp retention_workflow_ref(community_id, public_refs) do
    digest = :crypto.hash(:sha256, :erlang.term_to_binary(Enum.sort(public_refs)))
    "wallpaper-retention:#{community_id}:#{Base.encode16(digest, case: :lower)}"
  end

  @doc """
  Sends a best-effort provider delete request to assets-hub.

  Failures are logged but never raised, so a deleted asset stays deleted
  regardless of the enqueue outcome.

  ## Examples

      Deletion.enqueue(%CommunityAsset{id: 1, public_ref: "asset_1"})
      #=> {:ok, :pass}

  """
  @spec enqueue(CommunityAsset.t()) :: {:ok, :pass}
  def enqueue(%CommunityAsset{} = asset) do
    case deliver(asset) do
      {:ok, _} ->
        {:ok, :pass}

      {:error, ErrorCat.error_pattern(reason: :skipped)} ->
        {:ok, :pass}

      {:error, reason} ->
        Logger.warning(
          "Asset provider delete enqueue failed asset_id=#{asset.id} " <>
            "public_ref=#{asset.public_ref} reason=#{inspect(reason)}"
        )

        {:ok, :pass}
    end
  end

  @doc false
  def deliver(%CommunityAsset{} = asset), do: safe_enqueue(asset)

  @doc false
  def deliver_application_upload(data) when is_map(data) do
    case safe_enqueue(%CommunityAsset{
           id: Map.get(data, "id") || Map.get(data, :id),
           public_ref: Map.get(data, "public_ref") || Map.get(data, :public_ref),
           community_id: nil,
           storage: Map.get(data, "storage") || Map.get(data, :storage),
           storage_key: Map.get(data, "storage_key") || Map.get(data, :storage_key)
         }) do
      {:error, ErrorCat.error_pattern(reason: :skipped)} -> {:ok, :skipped}
      result -> result
    end
  end

  defp safe_enqueue(%CommunityAsset{} = asset) do
    do_enqueue(asset)
  rescue
    _exception ->
      {:error, ErrorCat.provider_delete_failure_unclassified()}
  catch
    _kind, _reason ->
      {:error, ErrorCat.provider_delete_failure_unclassified()}
  end

  defp do_enqueue(%CommunityAsset{storage: "r2", storage_key: storage_key} = asset)
       when is_binary(storage_key) do
    with {:ok, endpoint} <- endpoint(),
         {:ok, service_token} <-
           GroupherServer.ServiceAuth.client_token(
             "https://assets.groupher.com/internal",
             ["assets:object:delete"]
           ) do
      request(endpoint, service_token, asset)
    end
  end

  defp do_enqueue(_asset), do: {:error, ErrorCat.skipped()}

  defp request(endpoint, service_token, asset) do
    body = %{
      assetId: asset.id,
      assetPublicRef: asset.public_ref,
      communityId: asset.community_id,
      storage: asset.storage,
      storageKey: asset.storage_key
    }

    headers = [{"authorization", "Bearer #{service_token}"}]

    {duration_us, result} =
      :timer.tc(fn ->
        post("#{endpoint}/internal/assets/delete", body, headers: headers)
      end)

    duration_ms = div(duration_us, 1000)

    case result do
      {:ok, %Tesla.Env{status: status}} when status in 200..299 ->
        Logger.info(
          "Asset provider delete enqueued asset_id=#{asset.id} " <>
            "public_ref=#{asset.public_ref} duration_ms=#{duration_ms}"
        )

        {:ok, :pass}

      {:ok, %Tesla.Env{status: status}}
      when status in [408, 425, 429] or status in 500..599 ->
        {:error, ErrorCat.delete_enqueue_failed(%{status: status, duration_ms: duration_ms})}

      {:ok, %Tesla.Env{status: status}} ->
        {:error, ErrorCat.provider_delete_rejected(%{status: status, duration_ms: duration_ms})}

      {:error, reason} ->
        transport_failure(reason)
    end
  end

  @doc "Classifies transport failures without guessing from arbitrary error strings."
  def transport_failure(reason) do
    if temporary_transport?(reason) do
      {:error, ErrorCat.delete_enqueue_failed(%{kind: :transport})}
    else
      {:error, ErrorCat.provider_delete_failure_unclassified()}
    end
  end

  defp temporary_transport?(reason)
       when reason in [
              :timeout,
              :connect_timeout,
              :closed,
              :econnrefused,
              :econnreset,
              :enetunreach,
              :ehostunreach,
              :nxdomain
            ] do
    true
  end

  defp temporary_transport?(%{reason: reason}), do: temporary_transport?(reason)
  defp temporary_transport?({:timeout, _context}), do: true

  defp temporary_transport?({:failed_connect, details}) when is_list(details) do
    Enum.any?(details, fn
      {:inet, _options, reason} -> temporary_transport?(reason)
      {:inet6, _options, reason} -> temporary_transport?(reason)
      _ -> false
    end)
  end

  defp temporary_transport?(_reason), do: false

  defp endpoint do
    case GroupherServer.CMS.Assets.Endpoints.fetch("ASSETS_HUB_DELETE_ENDPOINT") do
      {:ok, endpoint} -> {:ok, endpoint}
      :error -> {:error, ErrorCat.provider_delete_configuration_invalid()}
    end
  end
end
