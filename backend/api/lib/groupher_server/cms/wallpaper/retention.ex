defmodule GroupherServer.CMS.Wallpaper.Retention do
  @moduledoc """
  Retains active/recent Wallpaper Snapshots and removes expired lifecycle data.

  Business position:

      CMS.Wallpaper facade / Wallpaper.Publisher
        -> Wallpaper.Retention
        -> Repo / CMS.Assets deletion
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Community,
    CommunityAsset,
    CommunityWallpaper,
    WallpaperPublishReceipt,
    WallpaperSnapshot,
    WallpaperSnapshotImage
  }

  alias CMS.Wallpaper.Reader

  @publish_receipt_retention_seconds 30 * 24 * 60 * 60
  @snapshot_delete_grace_seconds 2 * 60 * 60
  @orphan_asset_grace_seconds 30 * 60

  @doc "Returns the configured publish-receipt retention window."
  def publish_receipt_retention_seconds, do: @publish_receipt_retention_seconds

  @doc "Deletes expired receipts, Snapshots, and unreferenced generated assets."
  def reconcile_lifecycle do
    now = DateTime.utc_now(:second)

    receipt_count =
      from(receipt in WallpaperPublishReceipt, where: receipt.expires_at <= ^now)
      |> Repo.delete_all()
      |> elem(0)

    active_refs =
      from(state in CommunityWallpaper,
        select: [state.active_light_snapshot_ref, state.active_dark_snapshot_ref]
      )
      |> Repo.all()
      |> List.flatten()
      |> Enum.reject(&is_nil/1)
      |> MapSet.new()

    snapshots =
      from(snapshot in WallpaperSnapshot,
        where: not is_nil(snapshot.delete_after) and snapshot.delete_after <= ^now
      )
      |> Repo.all()
      |> Enum.reject(&MapSet.member?(active_refs, &1.public_ref))

    Enum.each(snapshots, fn snapshot ->
      community = Repo.get!(Community, snapshot.community_id)
      refs = Reader.snapshot_images(snapshot.public_ref) |> Enum.map(& &1.asset_public_ref)
      CMS.Assets.delete_generated_assets(community, refs)
      Repo.delete!(snapshot)
    end)

    cutoff = DateTime.add(now, -@orphan_asset_grace_seconds, :second)

    orphan_assets =
      from(asset in CommunityAsset,
        left_join: image in WallpaperSnapshotImage,
        on: image.asset_public_ref == asset.public_ref,
        where:
          asset.status == :active and is_nil(asset.deleted_at) and
            like(asset.storage_key, ^"%/wallpaper-generated/%") and asset.inserted_at <= ^cutoff and
            is_nil(image.id),
        select: {asset.community_id, asset.public_ref}
      )
      |> Repo.all()
      |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

    Enum.each(orphan_assets, fn {community_id, refs} ->
      CMS.Assets.delete_generated_assets(Repo.get!(Community, community_id), refs)
    end)

    %{
      orphan_assets: orphan_assets |> Map.values() |> List.flatten() |> length(),
      receipts: receipt_count,
      snapshots: length(snapshots)
    }
  end

  @doc "Marks all but the five active/recent supported Snapshots for deferred deletion."
  def retain_latest_snapshots(community_id, state, now) do
    active_refs =
      [state.active_light_snapshot_ref, state.active_dark_snapshot_ref] |> Enum.reject(&is_nil/1)

    history_refs =
      from(snapshot in WallpaperSnapshot,
        where: snapshot.community_id == ^community_id and is_nil(snapshot.delete_after),
        order_by: [desc: snapshot.history_used_at, desc: snapshot.inserted_at]
      )
      |> Repo.all()
      |> Enum.filter(&Reader.supported_snapshot?/1)
      |> Enum.map(& &1.public_ref)

    keep_refs = (active_refs ++ history_refs) |> Enum.uniq() |> Enum.take(5)

    from(snapshot in WallpaperSnapshot,
      where:
        snapshot.community_id == ^community_id and is_nil(snapshot.delete_after) and
          snapshot.public_ref not in ^keep_refs
    )
    |> Repo.update_all(
      set: [delete_after: DateTime.add(now, @snapshot_delete_grace_seconds, :second)]
    )
  end
end
