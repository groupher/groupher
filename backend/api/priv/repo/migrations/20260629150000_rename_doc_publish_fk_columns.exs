defmodule GroupherServer.Repo.Migrations.RenameDocPublishFkColumns do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename_column_if_exists(:article_snapshots, :article_workspace_id, :workspace_id)
    rename_column_if_exists(:doc_tree_nodes, :article_workspace_id, :workspace_id)
    rename_column_if_exists(:doc_tree_trash_items, :article_workspace_id, :workspace_id)
    rename_column_if_exists(:doc_tree_events, :binding_workspace_id, :workspace_id)
    rename_column_if_exists(:doc_tree_events, :published_snapshot_id, :snapshot_id)
    rename_column_if_exists(:publish_release_articles, :article_snapshot_id, :snapshot_id)

    rename_constraint_if_exists(
      :article_snapshots,
      :article_snapshots_article_workspace_id_fkey,
      :article_snapshots_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_nodes,
      :doc_tree_nodes_article_workspace_id_fkey,
      :doc_tree_nodes_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_trash_items,
      :doc_tree_trash_items_article_workspace_id_fkey,
      :doc_tree_trash_items_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_events,
      :doc_tree_events_binding_workspace_id_fkey,
      :doc_tree_events_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_events,
      :doc_tree_events_published_snapshot_id_fkey,
      :doc_tree_events_snapshot_id_fkey
    )

    rename_constraint_if_exists(
      :publish_release_articles,
      :publish_release_articles_article_snapshot_id_fkey,
      :publish_release_articles_snapshot_id_fkey
    )
  end

  def down do
    rename_column_if_exists(:article_snapshots, :workspace_id, :article_workspace_id)
    rename_column_if_exists(:doc_tree_nodes, :workspace_id, :article_workspace_id)
    rename_column_if_exists(:doc_tree_trash_items, :workspace_id, :article_workspace_id)
    rename_column_if_exists(:doc_tree_events, :workspace_id, :binding_workspace_id)
    rename_column_if_exists(:doc_tree_events, :snapshot_id, :published_snapshot_id)
    rename_column_if_exists(:publish_release_articles, :snapshot_id, :article_snapshot_id)

    rename_constraint_if_exists(
      :article_snapshots,
      :article_snapshots_workspace_id_fkey,
      :article_snapshots_article_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_nodes,
      :doc_tree_nodes_workspace_id_fkey,
      :doc_tree_nodes_article_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_trash_items,
      :doc_tree_trash_items_workspace_id_fkey,
      :doc_tree_trash_items_article_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_events,
      :doc_tree_events_workspace_id_fkey,
      :doc_tree_events_binding_workspace_id_fkey
    )

    rename_constraint_if_exists(
      :doc_tree_events,
      :doc_tree_events_snapshot_id_fkey,
      :doc_tree_events_published_snapshot_id_fkey
    )

    rename_constraint_if_exists(
      :publish_release_articles,
      :publish_release_articles_snapshot_id_fkey,
      :publish_release_articles_article_snapshot_id_fkey
    )
  end

  defp rename_column_if_exists(table, from, to) do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = '#{table}'
          AND column_name = '#{from}'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = '#{table}'
          AND column_name = '#{to}'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} RENAME COLUMN #{from} TO #{to};
      END IF;
    END
    $$;
    """)
  end

  defp rename_constraint_if_exists(table, from, to) do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE n.nspname = '#{@prefix}'
          AND t.relname = '#{table}'
          AND c.conname = '#{from}'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE n.nspname = '#{@prefix}'
          AND t.relname = '#{table}'
          AND c.conname = '#{to}'
      ) THEN
        ALTER TABLE #{@prefix}.#{table} RENAME CONSTRAINT #{from} TO #{to};
      END IF;
    END
    $$;
    """)
  end
end
