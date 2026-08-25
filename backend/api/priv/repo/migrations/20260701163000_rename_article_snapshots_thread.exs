defmodule GroupherServer.Repo.Migrations.RenameArticleSnapshotsThread do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    ALTER TABLE #{@prefix}.article_snapshots
      DROP CONSTRAINT IF EXISTS article_snapshots_article_thread_check;
    """)

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'article_thread'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'thread'
        )
      THEN
        ALTER TABLE #{@prefix}.article_snapshots
          RENAME COLUMN article_thread TO thread;
      END IF;
    END
    $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_article_thread_article_id_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_article_thread_workspace_id_index";|)

    create_if_not_exists(index(:article_snapshots, [:thread, :doc_id], prefix: @prefix))

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'thread'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE n.nspname = '#{@prefix}'
            AND t.relname = 'article_snapshots'
            AND c.conname = 'article_snapshots_thread_check'
        )
      THEN
        ALTER TABLE #{@prefix}.article_snapshots
          ADD CONSTRAINT article_snapshots_thread_check
          CHECK (thread IN ('post', 'doc', 'changelog', 'blog'));
      END IF;
    END
    $$;
    """)
  end

  def down do
    execute("""
    ALTER TABLE #{@prefix}.article_snapshots
      DROP CONSTRAINT IF EXISTS article_snapshots_thread_check;
    """)

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'thread'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'article_thread'
        )
      THEN
        ALTER TABLE #{@prefix}.article_snapshots
          RENAME COLUMN thread TO article_thread;
      END IF;
    END
    $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_thread_article_id_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_thread_workspace_id_index";|)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_thread_doc_id_index";|)
    create_if_not_exists(index(:article_snapshots, [:article_thread, :doc_id], prefix: @prefix))

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'article_snapshots'
            AND column_name = 'article_thread'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE n.nspname = '#{@prefix}'
            AND t.relname = 'article_snapshots'
            AND c.conname = 'article_snapshots_article_thread_check'
        )
      THEN
        ALTER TABLE #{@prefix}.article_snapshots
          ADD CONSTRAINT article_snapshots_article_thread_check
          CHECK (article_thread IN ('post', 'doc', 'changelog', 'blog'));
      END IF;
    END
    $$;
    """)
  end
end
