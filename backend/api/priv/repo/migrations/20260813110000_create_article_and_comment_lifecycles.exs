defmodule GroupherServer.Repo.Migrations.CreateArticleAndCommentLifecycles do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    create table(:article_lifecycles, prefix: @cms_prefix) do
      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:article_hash_id, :uuid, null: false)
      add(:state, :string, null: false)
      add(:version, :integer, null: false, default: 1)
      add(:changed_at, :timestamptz, null: false)
      add(:archived_at, :timestamptz)
      add(:deleted_at, :timestamptz)
      add(:destroyed_at, :timestamptz)
      timestamps()
    end

    create(
      unique_index(:article_lifecycles, [:community_id, :thread, :article_hash_id],
        prefix: @cms_prefix
      )
    )

    create(index(:article_lifecycles, [:community_id, :thread, :state], prefix: @cms_prefix))

    create table(:comment_lifecycles, prefix: @cms_prefix) do
      add(:comment_id, references(:comments, prefix: @cms_prefix, on_delete: :delete_all),
        null: false
      )

      add(:state, :string, null: false)
      add(:version, :integer, null: false, default: 1)
      add(:changed_at, :timestamptz, null: false)
      add(:deleted_at, :timestamptz)
      add(:destroyed_at, :timestamptz)
      timestamps()
    end

    create(unique_index(:comment_lifecycles, [:comment_id], prefix: @cms_prefix))
    create(index(:comment_lifecycles, [:state], prefix: @cms_prefix))

    for {table, thread} <- [
          {"posts", "post"},
          {"blogs", "blog"},
          {"changelogs", "changelog"},
          {"docs", "doc"}
        ] do
      execute("""
      INSERT INTO cms.article_lifecycles (
        community_id, thread, article_hash_id, state, version, changed_at,
        archived_at, deleted_at, inserted_at, updated_at
      )
      SELECT
        article.community_id,
        '#{thread}',
        article.article_hash_id,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM cms.trashed_articles AS trashed
            WHERE trashed.community_id = article.community_id
              AND trashed.thread = '#{thread}'
              AND trashed.article_hash_id = article.article_hash_id
          ) THEN 'deleted'
          WHEN BOOL_OR(article.stage = 'public' AND COALESCE(article.is_archived, FALSE)) THEN 'archived'
          WHEN BOOL_OR(article.stage = 'public') THEN 'published'
          ELSE 'draft_only'
        END,
        1,
        NOW(),
        MAX(article.archived_at) FILTER (WHERE article.stage = 'public' AND COALESCE(article.is_archived, FALSE)),
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM cms.trashed_articles AS trashed
            WHERE trashed.community_id = article.community_id
              AND trashed.thread = '#{thread}'
              AND trashed.article_hash_id = article.article_hash_id
          ) THEN NOW()
          ELSE NULL
        END,
        NOW(),
        NOW()
      FROM cms.#{table} AS article
      GROUP BY article.community_id, article.article_hash_id
      """)
    end

    execute("""
    INSERT INTO cms.comment_lifecycles (
      comment_id, state, version, changed_at, deleted_at, inserted_at, updated_at
    )
    SELECT
      comment.id,
      CASE WHEN comment.is_deleted THEN 'deleted' ELSE 'visible' END,
      1,
      NOW(),
      CASE WHEN comment.is_deleted THEN comment.updated_at ELSE NULL END,
      NOW(),
      NOW()
    FROM cms.comments AS comment
    """)

    execute("""
    UPDATE cms.comments
    SET body = NULL, body_html = 'this comment is deleted'
    WHERE is_deleted
    """)
  end

  def down do
    drop(table(:comment_lifecycles, prefix: @cms_prefix))
    drop(table(:article_lifecycles, prefix: @cms_prefix))
  end
end
