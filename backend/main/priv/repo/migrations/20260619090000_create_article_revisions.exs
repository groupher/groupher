defmodule GroupherServer.Repo.Migrations.CreateArticleRevisions do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:article_revisions, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:type, :string, null: false)

      # `article_id` is polymorphic across posts/docs/changelogs/blogs, so it
      # intentionally has no database-level FK.
      add(:article_id, :bigint)
      add(:article_draft_id, references(:article_drafts, prefix: @prefix, on_delete: :delete_all))
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))

      add(:title, :string, null: false)
      add(:slug, :string)
      add(:digest, :text)
      add(:document_json, :text, null: false)
      add(:content_hash, :string, null: false)
      add(:schema_version, :integer, null: false, default: 1)

      timestamps()
    end

    create(index(:article_revisions, [:community_id], prefix: @prefix))
    create(index(:article_revisions, [:thread, :article_id], prefix: @prefix))
    create(index(:article_revisions, [:thread, :article_draft_id], prefix: @prefix))
    create(index(:article_revisions, [:type], prefix: @prefix))
    create(index(:article_revisions, [:content_hash], prefix: @prefix))
    create(index(:article_revisions, [:inserted_at], prefix: @prefix))

    create(
      index(:article_revisions, [:community_id, :thread, :type, :article_id], prefix: @prefix)
    )

    create(
      index(:article_revisions, [:community_id, :thread, :type, :article_draft_id],
        prefix: @prefix
      )
    )

    create(
      constraint(:article_revisions, :article_revisions_target_check,
        prefix: @prefix,
        check:
          "(type = 'draft' AND article_draft_id IS NOT NULL AND article_id IS NULL) OR (type = 'published' AND article_id IS NOT NULL AND article_draft_id IS NULL)"
      )
    )

    create(
      constraint(:article_revisions, :article_revisions_type_check,
        prefix: @prefix,
        check: "type IN ('draft', 'published')"
      )
    )

    create(
      constraint(:article_revisions, :article_revisions_thread_check,
        prefix: @prefix,
        check: "thread IN ('post', 'doc', 'changelog', 'blog')"
      )
    )
  end
end
