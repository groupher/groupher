defmodule GroupherServer.Repo.Migrations.RepairDocTreeNodesWorkspaceId do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_tree_nodes') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'doc_tree_nodes'
            AND column_name = 'workspace_id'
        )
      THEN
        ALTER TABLE #{@prefix}.doc_tree_nodes
          ADD COLUMN workspace_id bigint;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_tree_nodes') IS NOT NULL
        AND to_regclass('#{@prefix}.article_workspaces') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'doc_tree_nodes'
            AND column_name = 'workspace_id'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE n.nspname = '#{@prefix}'
            AND t.relname = 'doc_tree_nodes'
            AND c.conname = 'doc_tree_nodes_workspace_id_fkey'
        )
      THEN
        ALTER TABLE #{@prefix}.doc_tree_nodes
          ADD CONSTRAINT doc_tree_nodes_workspace_id_fkey
          FOREIGN KEY (workspace_id)
          REFERENCES #{@prefix}.article_workspaces(id)
          ON DELETE SET NULL;
      END IF;
    END
    $$;
    """)

    create_if_not_exists(index(:doc_tree_nodes, [:workspace_id], prefix: @prefix))
  end

  def down do
    drop_if_exists(index(:doc_tree_nodes, [:workspace_id], prefix: @prefix))

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_tree_nodes') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'doc_tree_nodes'
            AND column_name = 'workspace_id'
        )
      THEN
        ALTER TABLE #{@prefix}.doc_tree_nodes
          DROP COLUMN workspace_id;
      END IF;
    END
    $$;
    """)
  end
end
