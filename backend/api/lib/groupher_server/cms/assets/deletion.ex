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

  alias CMS.Assets.{ErrorCat, Writer}
  alias CMS.Model.{Community, CommunityAsset}
  alias ServiceAuth.Client

  @timeout 10_000

  plug(Tesla.Middleware.JSON, engine: Jason)
  plug(Tesla.Middleware.Timeout, timeout: @timeout)

  @doc "Builds the provider-deletion projection for an expired Application upload."
  @spec delete_application_upload_object(map()) :: :ok
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
  @spec delete_generated_assets(Community.t(), [String.t()]) :: :ok
  def delete_generated_assets(%Community{id: community_id} = community, public_refs)
      when is_list(public_refs) do
    public_refs = Enum.filter(public_refs, &is_binary/1)

    from(asset in CommunityAsset,
      where:
        asset.community_id == ^community_id and asset.public_ref in ^public_refs and
          is_nil(asset.deleted_at)
    )
    |> Repo.all()
    |> Enum.each(fn asset ->
      with {:ok, deleted} <- Writer.delete(community, asset.id) do
        enqueue(deleted)
      end
    end)

    :ok
  end

  @doc """
  Sends a best-effort provider delete request to assets-hub.

  Failures are logged but never raised, so a deleted asset stays deleted
  regardless of the enqueue outcome.

  ## Examples

      Deletion.enqueue(%CommunityAsset{id: 1, public_ref: "asset_1"})
      #=> :ok

  """
  @spec enqueue(CommunityAsset.t()) :: :ok
  def enqueue(%CommunityAsset{} = asset) do
    case safe_enqueue(asset) do
      :ok ->
        :ok

      {:error, ErrorCat.error_pattern(reason: :skipped)} ->
        :ok

      {:error, reason} ->
        Logger.warning(
          "Asset provider delete enqueue failed asset_id=#{asset.id} " <>
            "public_ref=#{asset.public_ref} reason=#{inspect(reason)}"
        )

        :ok
    end
  end

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

        :ok

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
