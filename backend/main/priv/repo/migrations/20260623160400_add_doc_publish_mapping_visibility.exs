defmodule GroupherServer.Repo.Migrations.AddDocPublishMappingVisibility do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:doc_tree_node_publish_mappings, prefix: @prefix) do
      add_if_not_exists(:visibility, :string, null: false, default: "public")
      add_if_not_exists(:last_moved_to_draft_at, :timestamptz)
    end

    create_if_not_exists(
      index(:doc_tree_node_publish_mappings, [:community_id, :visibility], prefix: @prefix)
    )
  end
end
