defmodule GroupherServer.Repo.Migrations.RepairDocSlugStageIndexes do
  use Ecto.Migration

  @prefix "cms"

  def up do
    normalize_docs_slug_index()
    normalize_doc_tree_node_slug_indexes()
  end

  def down do
    drop_docs_slug_indexes()
    drop_doc_tree_node_slug_indexes()
  end

  defp normalize_docs_slug_index do
    drop_docs_slug_indexes()

    create_if_not_exists(
      unique_index(:docs, [:community_id, :slug],
        prefix: @prefix,
        where: "stage = 'public' AND slug IS NOT NULL",
        name: :docs_published_slug_idx
      )
    )
  end

  defp normalize_doc_tree_node_slug_indexes do
    drop_doc_tree_node_slug_indexes()
    dedupe_doc_tree_nodes()

    create_if_not_exists(
      unique_index(:doc_tree_nodes, [:community_id, :stage, :slug],
        prefix: @prefix,
        where: "group_id IS NULL AND type = 'group' AND slug IS NOT NULL",
        name: :doc_tree_nodes_root_slug_index
      )
    )

    create_if_not_exists(
      unique_index(:doc_tree_nodes, [:community_id, :stage, :title],
        prefix: @prefix,
        where: "group_id IS NULL AND type = 'group' AND title IS NOT NULL",
        name: :doc_tree_nodes_root_title_index
      )
    )

    create_if_not_exists(
      unique_index(:doc_tree_nodes, [:community_id, :stage, :group_id, :slug],
        prefix: @prefix,
        where: "group_id IS NOT NULL AND slug IS NOT NULL",
        name: :doc_tree_nodes_sibling_slug_index
      )
    )

    create_if_not_exists(
      unique_index(:doc_tree_nodes, [:community_id, :stage, :group_id, :title],
        prefix: @prefix,
        where: "group_id IS NOT NULL AND title IS NOT NULL",
        name: :doc_tree_nodes_sibling_title_index
      )
    )
  end

  defp drop_docs_slug_indexes do
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_slug_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_published_slug_idx;")
  end

  defp drop_doc_tree_node_slug_indexes do
    execute("DROP INDEX IF EXISTS #{@prefix}.doc_tree_nodes_root_slug_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.doc_tree_nodes_root_title_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.doc_tree_nodes_sibling_slug_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.doc_tree_nodes_sibling_title_index;")
  end

  defp dedupe_doc_tree_nodes do
    dedupe_doc_tree_nodes(
      """
      group_id IS NULL AND type = 'group' AND slug IS NOT NULL
      """,
      "community_id, stage, slug"
    )

    dedupe_doc_tree_nodes(
      """
      group_id IS NULL AND type = 'group' AND title IS NOT NULL
      """,
      "community_id, stage, title"
    )

    dedupe_doc_tree_nodes(
      """
      group_id IS NOT NULL AND slug IS NOT NULL
      """,
      "community_id, stage, group_id, slug"
    )

    dedupe_doc_tree_nodes(
      """
      group_id IS NOT NULL AND title IS NOT NULL
      """,
      "community_id, stage, group_id, title"
    )
  end

  defp dedupe_doc_tree_nodes(where_clause, partition_by) do
    execute("""
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY #{partition_by}
               ORDER BY updated_at DESC NULLS LAST, id DESC
             ) AS row_number
      FROM #{@prefix}.doc_tree_nodes
      WHERE #{where_clause}
    )
    DELETE FROM #{@prefix}.doc_tree_nodes AS node
    USING ranked
    WHERE node.id = ranked.id
      AND ranked.row_number > 1;
    """)
  end
end
