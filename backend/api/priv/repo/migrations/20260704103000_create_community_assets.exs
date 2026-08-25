defmodule GroupherServer.Repo.Migrations.CreateCommunityAssets do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:community_assets, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:uploader_id, references(:users, prefix: "account", on_delete: :nilify_all))

      add(:asset_type, :string, null: false, default: "file")
      add(:status, :string, null: false, default: "active")

      add(:title, :string)
      add(:filename, :string)
      add(:mime_type, :string)

      add(:url, :text, null: false)
      add(:url_hash, :string, null: false)
      add(:storage, :string)
      add(:storage_key, :string)
      add(:content_hash, :string)

      add(:size_bytes, :bigint, null: false, default: 0)
      add(:width, :integer)
      add(:height, :integer)
      add(:meta, :map, null: false, default: %{})
      add(:deleted_at, :timestamptz)

      timestamps()
    end

    create(index(:community_assets, [:community_id], prefix: @prefix))
    create(index(:community_assets, [:uploader_id], prefix: @prefix))
    create(index(:community_assets, [:asset_type], prefix: @prefix))
    create(index(:community_assets, [:status], prefix: @prefix))
    create(index(:community_assets, [:deleted_at], prefix: @prefix))
    create(index(:community_assets, [:content_hash], prefix: @prefix))

    create(
      unique_index(:community_assets, [:community_id, :url_hash],
        prefix: @prefix,
        where: "deleted_at IS NULL",
        name: :community_assets_community_url_hash_index
      )
    )

    create(
      unique_index(:community_assets, [:community_id, :storage, :storage_key],
        prefix: @prefix,
        where: "storage_key IS NOT NULL AND deleted_at IS NULL",
        name: :community_assets_community_storage_key_index
      )
    )

    create(
      index(:community_assets, [:community_id, :status, :inserted_at, :id],
        prefix: @prefix,
        where: "deleted_at IS NULL",
        name: :community_assets_active_page_index
      )
    )

    create table(:article_document_asset_refs, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :article_document_id,
        references(:article_documents, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:asset_id, references(:community_assets, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:thread, :string, null: false)
      add(:article_id, :id, null: false)
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

    create(index(:article_document_asset_refs, [:community_id], prefix: @prefix))
    create(index(:article_document_asset_refs, [:article_document_id], prefix: @prefix))
    create(index(:article_document_asset_refs, [:asset_id], prefix: @prefix))
    create(index(:article_document_asset_refs, [:thread, :article_id], prefix: @prefix))
    create(index(:article_document_asset_refs, [:usage], prefix: @prefix))
    create(index(:article_document_asset_refs, [:block_id], prefix: @prefix))

    create(
      unique_index(:article_document_asset_refs, [:article_document_id, :usage],
        prefix: @prefix,
        where: "usage IN ('cover', 'cover_dark')",
        name: :article_document_asset_refs_cover_usage_index
      )
    )

    create(
      unique_index(
        :article_document_asset_refs,
        [:article_document_id, :asset_id, :usage, :block_id],
        prefix: @prefix,
        where: "block_id IS NOT NULL",
        name: :article_document_asset_refs_block_index
      )
    )
  end
end
