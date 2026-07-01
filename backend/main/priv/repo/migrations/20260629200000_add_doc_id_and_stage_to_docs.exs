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

    # 2. other tables: replace old integer doc_id with UUID doc_id
    drop_old_doc_id("doc_tree_nodes")
    drop_old_doc_id("article_snapshots")
    drop_old_doc_id("doc_tree_events")
    drop_old_doc_id("doc_tree_trash_items")
  end

  defp drop_old_doc_id(table) do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
          AND column_name = 'doc_id' AND data_type = 'bigint'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} DROP COLUMN doc_id;
      END IF;
    END $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '#{@prefix}' AND table_name = '#{table}'
          AND column_name = 'doc_id'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} ADD COLUMN doc_id uuid;
      END IF;
    END $$;
    """)

    create_if_not_exists(index(:"#{table}", [:doc_id], prefix: @prefix))
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
