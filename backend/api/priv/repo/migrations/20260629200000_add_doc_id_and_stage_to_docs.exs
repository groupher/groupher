defmodule GroupherServer.Repo.Migrations.AddDocIdAndStageToDocs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    # 1. docs: add columns
    alter table(:docs, prefix: @prefix) do
      add_if_not_exists(:doc_id, :uuid)
      add_if_not_exists(:slug, :string)
      add_if_not_exists(:stage, :string, null: false, default: "public")
      add_if_not_exists(:template_key, :string)
      add_if_not_exists(:content_hash, :string)
      add_if_not_exists(:json, :text)
      add_if_not_exists(:schema_version, :integer, default: 1)
    end

    create_if_not_exists(unique_index(:docs, [:community_id, :stage, :doc_id], prefix: @prefix))
    create_if_not_exists(index(:docs, [:stage], prefix: @prefix))

    flush()

    backfill_docs_doc_id()

    # 2. other tables: replace old integer doc_id with UUID doc_id
    ensure_uuid_doc_id("doc_tree_nodes")
    ensure_uuid_doc_id("article_snapshots")
    ensure_uuid_doc_id("doc_tree_events")
    ensure_uuid_doc_id("doc_tree_trash_items")
  end

  defp backfill_docs_doc_id do
    execute("""
    UPDATE #{@prefix}.docs
    SET doc_id = (
      substr(md5('cms.docs:' || id::text), 1, 8) || '-' ||
      substr(md5('cms.docs:' || id::text), 9, 4) || '-' ||
      substr(md5('cms.docs:' || id::text), 13, 4) || '-' ||
      substr(md5('cms.docs:' || id::text), 17, 4) || '-' ||
      substr(md5('cms.docs:' || id::text), 21, 12)
    )::uuid
    WHERE doc_id IS NULL;
    """)
  end

  defp ensure_uuid_doc_id(table) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.#{table}') IS NULL THEN
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
          AND column_name = 'doc_id' AND data_type = 'bigint'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} RENAME COLUMN doc_id TO legacy_doc_row_id;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
          AND column_name = 'doc_id'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} ADD COLUMN doc_id uuid;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
          AND column_name = 'legacy_doc_row_id'
      ) THEN
        UPDATE #{@prefix}.#{table} AS target
        SET doc_id = docs.doc_id
        FROM #{@prefix}.docs AS docs
        WHERE docs.id = target.legacy_doc_row_id
          AND target.doc_id IS NULL;

        ALTER TABLE #{@prefix}.#{table} DROP COLUMN legacy_doc_row_id;
      END IF;
    END $$;
    """)

    create_doc_id_index(table)
  end

  defp create_doc_id_index(table) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.#{table}') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
            AND column_name = 'doc_id'
        )
      THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS #{table}_doc_id_index ON #{@prefix}.#{table} (doc_id)';
      END IF;
    END $$;
    """)
  end

  def down do
    for table <- [
          "doc_tree_nodes",
          "article_snapshots",
          "doc_tree_events",
          "doc_tree_trash_items"
        ] do
      execute("""
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
            AND column_name = 'doc_id' AND data_type = 'uuid'
        ) THEN
          ALTER TABLE #{@prefix}.#{table} DROP COLUMN doc_id;
          ALTER TABLE #{@prefix}.#{table} ADD COLUMN doc_id bigint;
        END IF;
      END $$;
      """)
    end

    drop_if_exists(index(:docs, [:community_id, :stage, :doc_id], prefix: @prefix))
    drop_if_exists(index(:docs, [:stage], prefix: @prefix))

    alter table(:docs, prefix: @prefix) do
      remove_if_exists(:doc_id, :uuid)
      remove_if_exists(:stage, :string)
      remove_if_exists(:content_hash, :string)
    end
  end
end
