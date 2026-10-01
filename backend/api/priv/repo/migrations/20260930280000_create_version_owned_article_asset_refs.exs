defmodule GroupherServer.Repo.Migrations.CreateVersionOwnedArticleAssetRefs do
  use Ecto.Migration

  @moduledoc "Creates Draft/Revision-owned Article asset membership."

  def change do
    create table(:article_asset_refs, prefix: "cms") do
      add(:community_id, references(:communities, on_delete: :delete_all), null: false)
      add(:asset_id, references(:community_assets, on_delete: :restrict), null: false)

      add(
        :body_draft_id,
        references(:article_body_drafts, type: :uuid, on_delete: :delete_all)
      )

      add(:revision_id, references(:article_revisions, type: :uuid, on_delete: :delete_all))
      add(:usage, :string, null: false, default: "inline")
      add(:block_id, :string)
      add(:block_type, :string)
      add(:position, :integer)
      add(:title, :string)
      add(:alt, :string)
      add(:source, :string)
      add(:meta, :map, null: false, default: %{})
      timestamps()
    end

    create(
      constraint(:article_asset_refs, :article_asset_refs_exactly_one_owner,
        prefix: "cms",
        check: "(body_draft_id IS NULL) <> (revision_id IS NULL)"
      )
    )

    create(index(:article_asset_refs, [:asset_id], prefix: "cms"))
    create(index(:article_asset_refs, [:body_draft_id], prefix: "cms"))
    create(index(:article_asset_refs, [:revision_id], prefix: "cms"))

    create(
      unique_index(:article_asset_refs, [:body_draft_id, :usage],
        prefix: "cms",
        name: :article_asset_refs_draft_cover_index,
        where: "body_draft_id IS NOT NULL AND usage IN ('cover', 'cover_dark')"
      )
    )

    create(
      unique_index(:article_asset_refs, [:revision_id, :usage],
        prefix: "cms",
        name: :article_asset_refs_revision_cover_index,
        where: "revision_id IS NOT NULL AND usage IN ('cover', 'cover_dark')"
      )
    )
  end
end
