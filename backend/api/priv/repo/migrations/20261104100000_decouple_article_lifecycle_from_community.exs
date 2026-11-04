defmodule GroupherServer.Repo.Migrations.DecoupleArticleLifecycleFromCommunity do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.article_lifecycles WHERE article_id IS NULL
      ) THEN
        RAISE EXCEPTION 'article_lifecycles contains rows without article_id';
      END IF;

      IF EXISTS (
        SELECT article_id
        FROM #{@cms}.article_lifecycles
        GROUP BY article_id
        HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION 'article_lifecycles contains duplicate article_id values';
      END IF;
    END
    $$
    """)

    execute("ALTER TABLE #{@cms}.article_lifecycles ALTER COLUMN article_id SET NOT NULL")
    execute("DROP INDEX IF EXISTS #{@cms}.article_lifecycles_article_id_index")

    execute(
      "CREATE UNIQUE INDEX article_lifecycles_article_id_index ON #{@cms}.article_lifecycles (article_id)"
    )

    execute(
      "DROP INDEX IF EXISTS #{@cms}.article_lifecycles_community_id_thread_article_hash_id_index"
    )

    execute("DROP INDEX IF EXISTS #{@cms}.article_lifecycles_community_id_thread_state_index")

    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_community_id_fkey"
    )

    execute("ALTER TABLE #{@cms}.article_lifecycles DROP COLUMN community_id")
  end

  def down do
    raise "ArticleLifecycle community ownership was intentionally removed; restore from a pre-migration snapshot"
  end
end
