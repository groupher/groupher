defmodule GroupherServer.Repo.Migrations.RebuildArticleDraftStorage do
  use Ecto.Migration

  @prefix "cms"

  def up do
    create_if_not_exists table(:article_drafts, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:article_id, :bigint)
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
      add(:title, :string, null: false)
      add(:slug, :string)
      add(:digest, :string, null: false)
      add(:template_key, :string)
      add(:json, :text, null: false)
      add(:markdown, :text)
      add(:markdown_toc, :map)
      add(:html, :text)
      add(:xml, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, null: false, default: 1)

      timestamps()
    end

    create_if_not_exists(index(:article_drafts, [:community_id], prefix: @prefix))
    create_if_not_exists(index(:article_drafts, [:thread, :article_id], prefix: @prefix))
    create_if_not_exists(index(:article_drafts, [:author_id], prefix: @prefix))
    create_if_not_exists(index(:article_drafts, [:content_hash], prefix: @prefix))

    create_if_not_exists(
      unique_index(:article_drafts, [:community_id, :template_key], prefix: @prefix)
    )

    create_if_not_exists(index(:doc_tree_node_drafts, [:article_draft_id], prefix: @prefix))

    execute("DELETE FROM cms.article_revisions WHERE type = 'draft';")

    execute(
      "ALTER TABLE cms.article_revisions DROP CONSTRAINT IF EXISTS article_revisions_target_check;"
    )

    create_if_not_exists(index(:article_revisions, [:thread, :article_draft_id], prefix: @prefix))

    create_if_not_exists(
      index(:article_revisions, [:community_id, :thread, :type, :article_id], prefix: @prefix)
    )

    create_if_not_exists(
      index(:article_revisions, [:community_id, :thread, :type, :article_draft_id],
        prefix: @prefix
      )
    )

    create_if_not_exists(
      index(:article_revisions, [:community_id, :thread, :type, :article_id, :revision_number],
        prefix: @prefix
      )
    )

    create_if_not_exists(
      index(
        :article_revisions,
        [:community_id, :thread, :type, :article_draft_id, :revision_number],
        prefix: @prefix
      )
    )

    execute("""
    ALTER TABLE cms.article_revisions
    ADD CONSTRAINT article_revisions_target_check
    CHECK (
      (type = 'draft' AND article_draft_id IS NOT NULL AND article_id IS NULL)
      OR
      (type = 'published' AND article_id IS NOT NULL AND article_draft_id IS NULL)
    );
    """)

    alter table(:doc_tree_node_drafts, prefix: @prefix) do
      remove_if_exists(:doc_draft_id, :bigint)
    end

    alter table(:article_revisions, prefix: @prefix) do
      remove_if_exists(:doc_draft_id, :bigint)
    end

    drop_if_exists(table(:doc_document_drafts, prefix: @prefix))
    drop_if_exists(table(:doc_drafts, prefix: @prefix))
  end

  def down do
    :ok
  end
end
