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

  alias GroupherServer.CMS.Model.CommunityAsset

  @timeout 10_000

  plug(Tesla.Middleware.JSON, engine: Jason)
  plug(Tesla.Middleware.Timeout, timeout: @timeout)

  @spec enqueue(CommunityAsset.t()) :: :ok
  def enqueue(%CommunityAsset{} = asset) do
    case safe_enqueue(asset) do
      :ok ->
        :ok

      {:error, :skipped} ->
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
      {:error, {:exception, Exception.message(exception)}}
  catch
    kind, reason ->
      {:error, {kind, reason}}
  end

  defp do_enqueue(%CommunityAsset{storage: "r2", storage_key: storage_key} = asset)
       when is_binary(storage_key) do
    with {:ok, endpoint} <- endpoint(),
         {:ok, service_token} <-
           GroupherServer.ServiceAuth.Client.token(
             "https://assets.groupher.com/internal",
             ["assets:object:delete"]
           ) do
      request(endpoint, service_token, asset)
    end
  end

  defp do_enqueue(_asset), do: {:error, :skipped}

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
         {:assets_hub_delete_enqueue, %{status: status, body: body, duration_ms: duration_ms}}}

      {:error, reason} ->
        {:error, {:assets_hub_delete_enqueue, %{reason: reason, duration_ms: duration_ms}}}
    end
  end

  defp endpoint do
    default_endpoint = if Mix.env() == :test, do: nil, else: "https://assets.groupher.com"

    [
      System.get_env("ASSETS_HUB_DELETE_ENDPOINT"),
      System.get_env("ASSETS_HUB_READ_ENDPOINT"),
      System.get_env("ASSETS_PUBLIC_ENDPOINT"),
      default_endpoint
    ]
    |> Enum.find_value(fn
      value when is_binary(value) ->
        value = String.trim(value)
        if value == "", do: nil, else: String.trim_trailing(value, "/")

      _ ->
        nil
    end)
    |> case do
      nil -> {:error, :skipped}
      endpoint -> {:ok, endpoint}
    end
  end
end
