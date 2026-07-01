defmodule GroupherServer.Repo.Migrations.DropExpandedFromDocTreeNodes do
  use Ecto.Migration

  def up do
    alter table(:doc_tree_nodes, prefix: "cms") do
      remove(:expanded, :boolean)
    end

    alter table(:doc_tree_node_drafts, prefix: "cms") do
      remove(:expanded, :boolean)
    end
  end

  def down do
    alter table(:doc_tree_nodes, prefix: "cms") do
      add(:expanded, :boolean, null: false, default: true)
    end

    alter table(:doc_tree_node_drafts, prefix: "cms") do
      add(:expanded, :boolean, null: false, default: true)
    end
  end
end
