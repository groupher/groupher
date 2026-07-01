defmodule GroupherServer.Repo.Migrations.UnifyDocPublishReleaseDocIds do
  use Ecto.Migration

  @prefix "cms"

  def up do
    ensure_article_snapshots_doc_id()
    normalize_publish_release_articles_doc_id()
    normalize_article_snapshots_target_check()
  end

  def down do
    execute(
      "ALTER TABLE #{@prefix}.article_snapshots DROP CONSTRAINT IF EXISTS article_snapshots_target_check;"
    )

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '#{@prefix}' AND table_name = 'publish_release_articles'
      ) THEN
        DROP INDEX IF EXISTS #{@prefix}.publish_release_articles_doc_id_index;
        ALTER TABLE #{@prefix}.publish_release_articles DROP COLUMN IF EXISTS doc_id;
        ALTER TABLE #{@prefix}.publish_release_articles ADD COLUMN IF NOT EXISTS article_id bigint;
      END IF;
    END $$;
    """)
  end

  defp ensure_article_snapshots_doc_id do
    execute("""
    DO $$
    DECLARE
      doc_id_type text;
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NULL THEN
        RETURN;
      END IF;

      SELECT data_type INTO doc_id_type
      FROM information_schema.columns
      WHERE table_schema = '#{@prefix}'
        AND table_name = 'article_snapshots'
        AND column_name = 'doc_id';

      IF doc_id_type IS NOT NULL AND doc_id_type <> 'uuid' THEN
        ALTER TABLE #{@prefix}.article_snapshots RENAME COLUMN doc_id TO legacy_doc_row_id;
        ALTER TABLE #{@prefix}.article_snapshots ADD COLUMN doc_id uuid;

        UPDATE #{@prefix}.article_snapshots AS target
        SET doc_id = docs.doc_id
        FROM #{@prefix}.docs AS docs
        WHERE docs.id = target.legacy_doc_row_id
          AND target.doc_id IS NULL;

        ALTER TABLE #{@prefix}.article_snapshots DROP COLUMN legacy_doc_row_id;
      ELSIF doc_id_type IS NULL THEN
        ALTER TABLE #{@prefix}.article_snapshots ADD COLUMN doc_id uuid;
      END IF;
    END $$;
    """)
  end

  defp normalize_article_snapshots_target_check do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '#{@prefix}' AND table_name = 'article_snapshots'
            AND column_name = 'article_id'
        )
      THEN
        UPDATE #{@prefix}.article_snapshots AS target
        SET doc_id = docs.doc_id
        FROM #{@prefix}.docs AS docs
        WHERE target.doc_id IS NULL
          AND docs.id = target.article_id;
      END IF;
    END $$;
    """)

    execute("DELETE FROM #{@prefix}.article_snapshots WHERE doc_id IS NULL;")

    execute(
      "ALTER TABLE #{@prefix}.article_snapshots DROP CONSTRAINT IF EXISTS article_snapshots_target_check;"
    )

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'article_snapshots_target_check'
          AND conrelid = '#{@prefix}.article_snapshots'::regclass
      ) THEN
        ALTER TABLE #{@prefix}.article_snapshots
          ADD CONSTRAINT article_snapshots_target_check
          CHECK (doc_id IS NOT NULL);
      END IF;
    END $$;
    """)
  end

  defp normalize_publish_release_articles_doc_id do
    drop_if_exists(index(:publish_release_articles, [:article_id], prefix: @prefix))

    execute("""
    DO $$
    DECLARE
      doc_id_type text;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '#{@prefix}' AND table_name = 'publish_release_articles'
      ) THEN
        SELECT data_type INTO doc_id_type
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'publish_release_articles'
          AND column_name = 'doc_id';

        IF doc_id_type IS NOT NULL AND doc_id_type <> 'uuid' THEN
          ALTER TABLE #{@prefix}.publish_release_articles DROP COLUMN doc_id;
          doc_id_type := NULL;
        END IF;

        IF doc_id_type IS NULL THEN
          ALTER TABLE #{@prefix}.publish_release_articles ADD COLUMN doc_id uuid;
        END IF;

        ALTER TABLE #{@prefix}.publish_release_articles DROP COLUMN IF EXISTS article_id;

        UPDATE #{@prefix}.publish_release_articles AS target
        SET doc_id = snapshots.doc_id
        FROM #{@prefix}.article_snapshots AS snapshots
        WHERE target.snapshot_id = snapshots.id
          AND target.doc_id IS NULL
          AND snapshots.doc_id IS NOT NULL;

        DELETE FROM #{@prefix}.publish_release_articles
        WHERE doc_id IS NULL
           OR snapshot_id IN (
             SELECT id FROM #{@prefix}.article_snapshots WHERE doc_id IS NULL
           );

        ALTER TABLE #{@prefix}.publish_release_articles ALTER COLUMN doc_id SET NOT NULL;
      END IF;
    END $$;
    """)

    create_if_not_exists(index(:publish_release_articles, [:doc_id], prefix: @prefix))
  end
end
