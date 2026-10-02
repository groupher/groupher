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

    execute("""
    DO $$
    BEGIN
      IF to_regclass('cms.article_document_asset_refs') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM cms.article_document_asset_refs legacy_ref
          LEFT JOIN cms.article_documents legacy_document
            ON legacy_document.id = legacy_ref.article_document_id
          LEFT JOIN cms.articles article
            ON article.community_id = legacy_ref.community_id
           AND article.thread = legacy_ref.thread
           AND article.inner_id = legacy_ref.article_id
          LEFT JOIN cms.article_drafts draft
            ON draft.article_id = article.id
          LEFT JOIN cms.article_publics public_head
            ON public_head.article_id = article.id
          WHERE article.id IS NULL
             OR (draft.body_draft_id IS NULL AND public_head.revision_id IS NULL)
        ) THEN
          RAISE EXCEPTION
            'legacy article asset refs cannot be mapped to the Revision/Draft ownership model';
        END IF;

        INSERT INTO cms.article_asset_refs (
          community_id,
          asset_id,
          body_draft_id,
          revision_id,
          usage,
          block_id,
          block_type,
          position,
          title,
          alt,
          source,
          meta,
          inserted_at,
          updated_at
        )
        SELECT
          legacy_ref.community_id,
          legacy_ref.asset_id,
          CASE WHEN public_head.revision_id IS NULL THEN draft.body_draft_id ELSE NULL END,
          public_head.revision_id,
          legacy_ref.usage,
          legacy_ref.block_id,
          legacy_ref.block_type,
          legacy_ref.position,
          legacy_ref.title,
          legacy_ref.alt,
          legacy_ref.source,
          legacy_ref.meta,
          legacy_ref.inserted_at,
          legacy_ref.updated_at
        FROM cms.article_document_asset_refs legacy_ref
        JOIN cms.article_documents legacy_document
          ON legacy_document.id = legacy_ref.article_document_id
        JOIN cms.articles article
          ON article.community_id = legacy_ref.community_id
         AND article.thread = legacy_ref.thread
         AND article.inner_id = legacy_ref.article_id
        LEFT JOIN cms.article_drafts draft
          ON draft.article_id = article.id
        LEFT JOIN cms.article_publics public_head
          ON public_head.article_id = article.id
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;
    """)
  end
end
