defmodule GroupherServer.Repo.Migrations.RenameIconColumnsToMarker do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(table(:community_tags, prefix: @prefix), :icon, to: :marker)
    rename(table(:doc_tree_nodes, prefix: @prefix), :icon, to: :marker)
    rename(table(:doc_tree_node_drafts, prefix: @prefix), :icon, to: :marker)
  end

  def down do
    rename(table(:community_tags, prefix: @prefix), :marker, to: :icon)
    rename(table(:doc_tree_nodes, prefix: @prefix), :marker, to: :icon)
    rename(table(:doc_tree_node_drafts, prefix: @prefix), :marker, to: :icon)
  end
end
