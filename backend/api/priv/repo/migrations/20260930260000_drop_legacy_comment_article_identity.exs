defmodule GroupherServer.Repo.Migrations.DropLegacyCommentArticleIdentity do
  use Ecto.Migration

  @moduledoc """
  Makes stable Article identity authoritative for comments and comment pins.

  The migration deliberately fails if a retained Comment was not assigned a
  stable `article_id`; cutover must repair or discard such rows before schema
  destruction rather than silently keeping a mixed identity model.
  """

  def up do
    execute(
      "ALTER TABLE cms.post_solutions " <>
        "DROP CONSTRAINT IF EXISTS post_solutions_comment_belongs_to_post_fkey"
    )

    alter table(:post_solutions, prefix: "cms") do
      add(:article_id, references(:articles, type: :uuid, on_delete: :delete_all))
    end

    execute("""
    UPDATE cms.post_solutions AS solution
    SET article_id = comment.article_id
    FROM cms.comments AS comment
    WHERE comment.id = solution.comment_id
    """)

    drop_if_exists(unique_index(:post_solutions, [:post_id], prefix: "cms"))

    alter table(:post_solutions, prefix: "cms") do
      modify(:article_id, :uuid, null: false)
      remove(:post_id)
    end

    create(unique_index(:post_solutions, [:article_id], prefix: "cms"))

    alter table(:comments, prefix: "cms") do
      modify(:article_id, :uuid, null: false)
      remove(:article_hash_id)
      remove(:post_id)
      remove(:blog_id)
      remove(:changelog_id)
      remove(:doc_id)
    end

    create(unique_index(:comments, [:id, :article_id], prefix: "cms"))

    execute("""
    ALTER TABLE cms.post_solutions
    ADD CONSTRAINT post_solutions_comment_belongs_to_article_fkey
    FOREIGN KEY (comment_id, article_id)
    REFERENCES cms.comments(id, article_id)
    ON DELETE CASCADE
    """)

    alter table(:pinned_comments, prefix: "cms") do
      modify(:article_id, :uuid, null: false)

      remove(:post_id)
      remove(:blog_id)
      remove(:changelog_id)
      remove(:doc_id)
    end
  end

  def down do
    execute("""
    ALTER TABLE cms.post_solutions
    DROP CONSTRAINT IF EXISTS post_solutions_comment_belongs_to_article_fkey
    """)

    drop_if_exists(unique_index(:comments, [:id, :article_id], prefix: "cms"))
    drop_if_exists(unique_index(:post_solutions, [:article_id], prefix: "cms"))

    alter table(:pinned_comments, prefix: "cms") do
      add(:doc_id, :bigint)
      add(:changelog_id, :bigint)
      add(:blog_id, :bigint)
      add(:post_id, :bigint)
      modify(:article_id, :uuid, null: true)
    end

    alter table(:comments, prefix: "cms") do
      add(:doc_id, :bigint)
      add(:changelog_id, :bigint)
      add(:blog_id, :bigint)
      add(:post_id, :bigint)
      add(:article_hash_id, :uuid)
      modify(:article_id, :uuid, null: true)
    end

    alter table(:post_solutions, prefix: "cms") do
      add(:post_id, :bigint)
      remove(:article_id)
    end

    create(unique_index(:post_solutions, [:post_id], prefix: "cms"))
  end
end
