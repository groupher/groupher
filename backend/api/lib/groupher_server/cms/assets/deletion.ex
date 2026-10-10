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

  alias GroupherServer.{CMS, Repo, ServiceAuth}

  alias CMS.Assets.{ErrorCat, Persist}
  alias CMS.Model.{Community, CommunityAsset}
  alias ServiceAuth.Client

  @timeout 10_000

  plug(Tesla.Middleware.JSON, engine: Jason)
  plug(Tesla.Middleware.Timeout, timeout: @timeout)

  @doc "Builds the provider-deletion projection for an expired Application upload."
  @spec delete_application_upload_object(map()) :: {:ok, :pass}
  def delete_application_upload_object(upload) do
    enqueue(%CommunityAsset{
      id: upload.id,
      public_ref: upload.public_ref,
      community_id: nil,
      storage: upload.storage,
      storage_key: upload.storage_key
    })
  end

  @doc "Soft-deletes generated assets and enqueues provider cleanup."
  @spec delete_generated_assets(Community.t(), [String.t()], keyword()) :: {:ok, :pass}
  def delete_generated_assets(%Community{id: community_id} = community, public_refs, opts \\ [])
      when is_list(public_refs) and is_list(opts) do
    public_refs = Enum.filter(public_refs, &is_binary/1)

    workflow_ref =
      Keyword.get(opts, :workflow_ref, retention_workflow_ref(community_id, public_refs))

    from(asset in CommunityAsset,
      where:
        asset.community_id == ^community_id and asset.public_ref in ^public_refs and
          is_nil(asset.deleted_at)
    )
    |> Repo.all()
    |> Enum.reduce_while({:ok, :pass}, fn asset, {:ok, :pass} ->
      result =
        Repo.transaction(fn ->
          with {:ok, deleted} <- Persist.delete(community, asset.id, {:workflow, workflow_ref}),
               {:ok, _event} <-
                 CMS.Outbox.send(%{
                   event: "asset.provider_delete",
                   worker: CMS.Outbox.Workers.Asset.Cleanup,
                   resource_type: "community_asset",
                   resource_id: deleted.id,
                   identity: {:workflow, workflow_ref},
                   effect_key: "asset:#{deleted.id}",
                   data: %{asset_id: deleted.id, public_ref: deleted.public_ref}
                 }) do
            :pass
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end)

      case result do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
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

  defp safe_enqueue(%CommunityAsset{} = asset) do
    do_enqueue(asset)
  rescue
    exception ->
      {:error, ErrorCat.delete_enqueue_failed(Exception.message(exception))}
  catch
    kind, reason ->
      {:error, ErrorCat.delete_enqueue_failed({kind, reason})}
  end

  defp do_enqueue(%CommunityAsset{storage: "r2", storage_key: storage_key} = asset)
       when is_binary(storage_key) do
    with {:ok, endpoint} <- endpoint(),
         {:ok, service_token} <-
           Client.token(
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

      {:ok, %Tesla.Env{status: status, body: body}} ->
        {:error,
         ErrorCat.delete_enqueue_failed(%{status: status, body: body, duration_ms: duration_ms})}

      {:error, reason} ->
        {:error, ErrorCat.delete_enqueue_failed(%{reason: reason, duration_ms: duration_ms})}
    end
  end

  defp endpoint do
    case GroupherServer.CMS.Assets.Endpoints.fetch("ASSETS_HUB_DELETE_ENDPOINT") do
      {:ok, endpoint} -> {:ok, endpoint}
      :error -> {:error, ErrorCat.delete_enqueue_failed("ASSETS_HUB_DELETE_ENDPOINT is required")}
    end
  end
end
