defmodule GroupherServer.Repo.Migrations.DropExpandedFromDocTreeNodes do
  use Ecto.Migration

  def change do
    alter table(:doc_tree_nodes, prefix: "cms") do
      remove(:expanded, :boolean)
    end

    alter table(:doc_tree_node_drafts, prefix: "cms") do
      remove(:expanded, :boolean)
    end
  end
end
