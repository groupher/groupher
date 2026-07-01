defmodule GroupherServer.Repo.Migrations.UnifyDocIdRemoveArticleWorkspaces do
  use Ecto.Migration

  @prefix "cms"

  def up do
    ensure_docs_stage_columns()
    ensure_uuid_doc_id("doc_tree_nodes")
    ensure_uuid_doc_id("article_snapshots")
    ensure_uuid_doc_id("doc_tree_events")
    ensure_uuid_doc_id("doc_tree_trash_items")

    alter table(:doc_tree_nodes, prefix: @prefix) do
      remove_if_exists(:workspace_id, :bigint)
    end

    alter table(:article_snapshots, prefix: @prefix) do
      remove_if_exists(:workspace_id, :bigint)
      remove_if_exists(:article_id, :bigint)
    end

    alter table(:doc_tree_events, prefix: @prefix) do
      remove_if_exists(:workspace_id, :bigint)
    end

    alter table(:doc_tree_trash_items, prefix: @prefix) do
      remove_if_exists(:workspace_id, :bigint)
    end

    drop_if_exists(table(:article_workspaces, prefix: @prefix))

    drop_if_exists(
      index(:docs, [:slug],
        prefix: @prefix,
        name: :docs_slug_index
      )
    )

    create_if_not_exists(
      unique_index(:docs, [:slug],
        prefix: @prefix,
        where: "stage = 'public'",
        name: :docs_published_slug_idx
      )
    )
  end

  defp ensure_docs_stage_columns do
    alter table(:docs, prefix: @prefix) do
      add_if_not_exists(:doc_id, :uuid)
      add_if_not_exists(:slug, :string)
      add_if_not_exists(:stage, :string, null: false, default: "public")
      add_if_not_exists(:template_key, :string)
      add_if_not_exists(:content_hash, :string)
      add_if_not_exists(:json, :text)
      add_if_not_exists(:schema_version, :integer, default: 1)
    end

    flush()

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
    drop_if_exists(
      index(:docs, [:slug],
        prefix: @prefix,
        name: :docs_published_slug_idx
      )
    )

    create_if_not_exists(
      unique_index(:docs, [:slug],
        prefix: @prefix,
        name: :docs_slug_index
      )
    )

    create_if_not_exists table(:article_workspaces, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:article_thread, :string, null: false)
      add(:article_id, :bigint)
      add(:stage, :string, null: false, default: "draft")
      add(:title, :string)
      add(:subtitle, :string)
      add(:slug, :string)
      add(:digest, :string)
      add(:template_key, :string)
      add(:json, :text)
      add(:markdown, :text)
      add(:html, :text)
      add(:xml, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, default: 1)
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))

      timestamps()
    end

    create_if_not_exists(
      unique_index(:article_workspaces, [:community_id, :article_thread, :stage, :article_id],
        prefix: @prefix
      )
    )

    alter table(:doc_tree_nodes, prefix: @prefix) do
      add_if_not_exists(:workspace_id, :bigint)
    end

    alter table(:article_snapshots, prefix: @prefix) do
      add_if_not_exists(:workspace_id, :bigint)
      add_if_not_exists(:article_id, :bigint)
    end

    alter table(:doc_tree_events, prefix: @prefix) do
      add_if_not_exists(:workspace_id, :bigint)
    end

    alter table(:doc_tree_trash_items, prefix: @prefix) do
      add_if_not_exists(:workspace_id, :bigint)
    end
  end
end
