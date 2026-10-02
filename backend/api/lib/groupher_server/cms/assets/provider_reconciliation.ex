defmodule GroupherServer.CMS.Assets.ProviderReconciliation do
  @moduledoc """
  Repairs provider-deletion intents for database assets already marked deleted.

  Reconciliation is deliberately an outbox repair path: it never resurrects an
  asset and it never calls the provider inline from a request.

  Business position:

      asset maintenance job
        -> ProviderReconciliation
        -> missing provider-delete intent -> Asset cleanup worker
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityAsset}
  alias CMS.Outbox.Event

  @default_age_seconds 15 * 60

  @doc "Re-enqueues missing provider-delete intents for old soft-deleted assets."
  def enqueue_missing(%Community{id: community_id}, opts \\ []) do
    cutoff =
      DateTime.add(
        DateTime.utc_now(:second),
        -Keyword.get(opts, :age_seconds, @default_age_seconds),
        :second
      )

    assets =
      Repo.all(
        from(asset in CommunityAsset,
          where:
            asset.community_id == ^community_id and asset.status == :deleted and
              not is_nil(asset.deleted_at) and asset.deleted_at <= ^cutoff,
          order_by: [asc: asset.deleted_at, asc: asset.id]
        )
      )

    Enum.reduce(assets, {:ok, 0}, fn asset, {:ok, count} ->
      if pending_intent?(asset.id) do
        {:ok, count}
      else
        case CMS.Outbox.send(%{
               event: "asset.provider_delete",
               worker: CMS.Outbox.Workers.Asset.Cleanup,
               resource_type: "community_asset",
               resource_id: asset.id,
               command_id: Ecto.UUID.generate(),
               data: %{asset_id: asset.id, public_ref: asset.public_ref}
             }) do
          {:ok, _event} -> {:ok, count + 1}
          {:error, reason} -> {:error, reason}
        end
      end
    end)
  end

  @doc "Returns provider objects that have no Phoenix asset authority row."
  def scan_provider_orphans(community, provider_objects, opts \\ [])

  def scan_provider_orphans(%Community{} = community, provider_objects, opts)
      when is_list(provider_objects) and is_list(opts) do
    authorities = authority_keys(community)

    cutoff =
      DateTime.add(
        DateTime.utc_now(:second),
        -Keyword.get(opts, :grace_seconds, 15 * 60),
        :second
      )

    active_upload_keys = MapSet.new(Keyword.get(opts, :active_upload_keys, []))

    {:ok,
     Enum.reject(provider_objects, fn object ->
       identity = provider_identity(object)

       MapSet.member?(authorities, identity) or
         MapSet.member?(active_upload_keys, identity) or recent_provider_object?(object, cutoff)
     end)}
  end

  @doc false
  def scan_provider_orphans(%Community{} = community, fetch_page, opts)
      when is_function(fetch_page, 2) and is_list(opts) do
    cursor = Keyword.get(opts, :cursor)
    limit = opts |> Keyword.get(:limit, 100) |> min(500) |> max(1)

    with {:ok, %{objects: objects, next_cursor: next_cursor}} <- fetch_page.(cursor, limit),
         {:ok, orphans} <- scan_provider_orphans(community, objects, opts) do
      {:ok, %{orphans: orphans, next_cursor: next_cursor, cursor: cursor, limit: limit}}
    end
  end

  defp authority_keys(%Community{id: community_id}) do
    Repo.all(
      from(asset in CommunityAsset,
        where:
          asset.community_id == ^community_id and not is_nil(asset.storage) and
            not is_nil(asset.storage_key),
        select: {asset.storage, asset.storage_key}
      )
    )
    |> MapSet.new()
  end

  defp provider_identity(object) do
    {Map.get(object, :storage) || Map.get(object, "storage"),
     Map.get(object, :storage_key) || Map.get(object, "storageKey") ||
       Map.get(object, "storage_key")}
  end

  defp recent_provider_object?(object, cutoff) do
    case Map.get(object, :inserted_at) || Map.get(object, "inserted_at") ||
           Map.get(object, :created_at) || Map.get(object, "created_at") do
      %DateTime{} = inserted_at -> DateTime.compare(inserted_at, cutoff) == :gt
      _ -> false
    end
  end

  defp pending_intent?(asset_id) do
    Repo.exists?(
      from(event in Event,
        where:
          event.event == "asset.provider_delete" and event.resource_type == "community_asset" and
            event.resource_id == ^to_string(asset_id) and
            event.status in [:pending, :executing, :completed]
      )
    )
  end
end
