defmodule GroupherServer.Repo.Migrations.ExtendArticleAssetRefsToContentOwners do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:article_asset_refs, prefix: @prefix) do
      add(
        :working_copy_id,
        references(:article_working_copies, type: :uuid, prefix: @prefix, on_delete: :restrict)
      )

      add(
        :snapshot_id,
        references(:article_snapshots, type: :uuid, prefix: @prefix, on_delete: :restrict)
      )
    end

    drop(constraint(:article_asset_refs, :article_asset_refs_exactly_one_owner, prefix: @prefix))

    create(
      constraint(:article_asset_refs, :article_asset_refs_exactly_one_owner,
        prefix: @prefix,
        check: "num_nonnulls(body_draft_id, revision_id, working_copy_id, snapshot_id) = 1"
      )
    )

    create(index(:article_asset_refs, [:working_copy_id], prefix: @prefix))
    create(index(:article_asset_refs, [:snapshot_id], prefix: @prefix))

    create(
      unique_index(:article_asset_refs, [:working_copy_id, :usage],
        prefix: @prefix,
        name: :article_asset_refs_working_copy_cover_index,
        where: "working_copy_id IS NOT NULL AND usage IN ('cover', 'cover_dark')"
      )
    )

    create(
      unique_index(:article_asset_refs, [:snapshot_id, :usage],
        prefix: @prefix,
        name: :article_asset_refs_snapshot_cover_index,
        where: "snapshot_id IS NOT NULL AND usage IN ('cover', 'cover_dark')"
      )
    )
  end
end
