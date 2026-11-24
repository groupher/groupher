defmodule GroupherServer.CMS.Assets.GC do
  @moduledoc """
  Finds conservative database-asset GC candidates without deleting them.

  Business position:

      asset maintenance job
        -> Assets.GC
        -> completeness guard + retention checks -> deletion candidates
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Assets.Completeness

  alias CMS.Model.{
    ArticleAssetRef,
    Community,
    CommunityApplicationLogoUpload,
    CommunityAsset,
    CommunityLifecycleBlocker,
    AssetReplacementPlan
  }

  @default_safety_window_seconds 7 * 24 * 60 * 60

  @doc "Returns active assets older than the safety window with no authoritative refs."
  def candidates(%Community{id: community_id}, opts \\ []) do
    with {:ok, _} <- Completeness.guard(community_id) do
      cutoff = cutoff(opts)
      {:ok, community_id |> candidate_query(cutoff) |> Repo.all() |> describe_candidates()}
    end
  end

  defp cutoff(opts) do
    seconds = Keyword.get(opts, :safety_window_seconds, @default_safety_window_seconds)
    DateTime.add(DateTime.utc_now(:second), -seconds, :second)
  end

  defp candidate_query(community_id, cutoff) do
    from(asset in CommunityAsset,
      as: :asset,
      where:
        asset.community_id == ^community_id and asset.status == :active and
          is_nil(asset.deleted_at) and is_nil(asset.archived_at) and asset.inserted_at <= ^cutoff,
      where: not exists(authoritative_refs_query()),
      where: not exists(pending_upload_query()),
      where: asset.community_id not in subquery(CMS.ContentImport.active_community_ids()),
      where: not exists(pending_replacement_query()),
      where: not exists(legal_hold_query()),
      select: asset
    )
  end

  defp authoritative_refs_query do
    from(ref in ArticleAssetRef, where: ref.asset_id == parent_as(:asset).id, select: 1)
  end

  defp pending_upload_query do
    from(upload in CommunityApplicationLogoUpload,
      where: upload.community_asset_id == parent_as(:asset).id,
      where: upload.status in [:pending, :finalized],
      select: 1
    )
  end

  defp pending_replacement_query do
    from(plan in AssetReplacementPlan,
      where: plan.community_id == parent_as(:asset).community_id,
      where: plan.status in [:pending, :partially_applied],
      where:
        plan.from_asset_id == parent_as(:asset).id or plan.to_asset_id == parent_as(:asset).id,
      select: 1
    )
  end

  defp legal_hold_query do
    from(blocker in CommunityLifecycleBlocker,
      where: blocker.community_id == parent_as(:asset).community_id,
      where: blocker.blocker_type == :ops_legal_hold,
      where: is_nil(blocker.ended_at),
      select: 1
    )
  end

  defp describe_candidates(assets) do
    Enum.map(
      assets,
      &%{asset: &1, reason: "no_authoritative_refs", observed_at: DateTime.utc_now(:second)}
    )
  end
end
