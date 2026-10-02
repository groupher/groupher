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
  alias CMS.ContentImport.Persistence.Job, as: ImportJob

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
    with :ok <- Completeness.guard(community_id) do
      cutoff =
        DateTime.add(
          DateTime.utc_now(:second),
          -Keyword.get(opts, :safety_window_seconds, @default_safety_window_seconds),
          :second
        )

      refs = from(ref in ArticleAssetRef, where: ref.asset_id == parent_as(:asset).id, select: 1)

      pending_upload =
        from(upload in CommunityApplicationLogoUpload,
          where:
            upload.community_asset_id == parent_as(:asset).id and
              upload.status in [:pending, :finalized],
          select: 1
        )

      pending_import =
        from(job in ImportJob,
          where:
            job.community_id == parent_as(:asset).community_id and
              job.status in [:staging, :ready, :applying],
          select: 1
        )

      pending_replacement =
        from(plan in AssetReplacementPlan,
          where:
            plan.community_id == parent_as(:asset).community_id and
              plan.status in [:pending, :partially_applied] and
              (plan.from_asset_id == parent_as(:asset).id or
                 plan.to_asset_id == parent_as(:asset).id),
          select: 1
        )

      legal_hold =
        from(blocker in CommunityLifecycleBlocker,
          where:
            blocker.community_id == parent_as(:asset).community_id and
              blocker.blocker_type == :ops_legal_hold and is_nil(blocker.ended_at),
          select: 1
        )

      {:ok,
       Repo.all(
         from(asset in CommunityAsset,
           as: :asset,
           where:
             asset.community_id == ^community_id and asset.status == :active and
               is_nil(asset.deleted_at) and is_nil(asset.archived_at) and
               asset.inserted_at <= ^cutoff,
           where: not exists(refs),
           where: not exists(pending_upload),
           where: not exists(pending_import),
           where: not exists(pending_replacement),
           where: not exists(legal_hold),
           select: asset
         )
       )
       |> Enum.map(
         &%{asset: &1, reason: "no_authoritative_refs", observed_at: DateTime.utc_now(:second)}
       )}
    end
  end
end
