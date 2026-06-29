defmodule GroupherServer.Repo.Migrations.CreateArticleSnapshots do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:article_snapshots, prefix: @prefix) do
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

    create(index(:article_snapshots, [:community_id], prefix: @prefix))
    create(index(:article_snapshots, [:thread, :article_id], prefix: @prefix))
    create(index(:article_snapshots, [:thread, :article_draft_id], prefix: @prefix))
    create(index(:article_snapshots, [:type], prefix: @prefix))
    create(index(:article_snapshots, [:content_hash], prefix: @prefix))
    create(index(:article_snapshots, [:inserted_at], prefix: @prefix))

    create(
      index(:article_snapshots, [:community_id, :thread, :type, :article_id], prefix: @prefix)
    )

    create(
      index(:article_snapshots, [:community_id, :thread, :type, :article_draft_id],
        prefix: @prefix
      )
    )

    create(
      constraint(:article_snapshots, :article_snapshots_target_check,
        prefix: @prefix,
        check:
          "(type = 'draft' AND article_draft_id IS NOT NULL AND article_id IS NULL) OR (type = 'published' AND article_id IS NOT NULL AND article_draft_id IS NULL)"
      )
    )

    create(
      constraint(:article_snapshots, :article_snapshots_type_check,
        prefix: @prefix,
        check: "type IN ('draft', 'published')"
      )
    )

    create(
      constraint(:article_snapshots, :article_snapshots_thread_check,
        prefix: @prefix,
        check: "thread IN ('post', 'doc', 'changelog', 'blog')"
      )
    )
  end
end
