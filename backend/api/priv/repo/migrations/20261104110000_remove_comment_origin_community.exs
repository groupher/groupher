defmodule GroupherServer.Repo.Migrations.RemoveCommentOriginCommunity do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("DROP TRIGGER IF EXISTS comments_community_matches_article ON #{@cms}.comments")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ensure_comment_community_matches_article()")

    execute(
      "ALTER TABLE #{@cms}.comments DROP CONSTRAINT IF EXISTS comments_doc_origin_required_check"
    )

    execute("ALTER TABLE #{@cms}.comments DROP CONSTRAINT IF EXISTS comments_community_id_fkey")

    execute(
      "ALTER TABLE #{@cms}.comments DROP CONSTRAINT IF EXISTS comments_origin_community_id_fkey"
    )

    execute("DROP INDEX IF EXISTS #{@cms}.comments_community_id_thread_article_hash_id_index")
    execute("DROP INDEX IF EXISTS #{@cms}.comments_community_id_thread_index")
    execute("DROP INDEX IF EXISTS #{@cms}.comments_community_id_index")
    execute("ALTER TABLE #{@cms}.comments DROP COLUMN origin_community_id")
  end

  def down do
    raise "Comment submission Community was intentionally removed; restore from a pre-migration snapshot"
  end
end
