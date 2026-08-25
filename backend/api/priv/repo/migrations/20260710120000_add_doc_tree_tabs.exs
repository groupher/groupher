defmodule GroupherServer.Repo.Migrations.AddDocTreeTabs do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:doc_tree_nodes, prefix: @prefix) do
      add(:tab_id, :string)
    end

    drop(constraint(:doc_tree_nodes, :doc_tree_nodes_type_check, prefix: @prefix))

    create(
      constraint(:doc_tree_nodes, :doc_tree_nodes_type_check,
        check: "type IN ('tab', 'group', 'page', 'link', 'pin')",
        prefix: @prefix
      )
    )

    create(index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :tab_id], prefix: @prefix))

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_title_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_title_index";|)

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :slug],
        prefix: @prefix,
        where: "type = 'tab' AND slug IS NOT NULL",
        name: :doc_tree_nodes_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :title],
        prefix: @prefix,
        where: "type = 'tab' AND title IS NOT NULL",
        name: :doc_tree_nodes_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :tab_id, :type, :slug],
        prefix: @prefix,
        where: "type IN ('group', 'pin') AND tab_id IS NOT NULL AND slug IS NOT NULL",
        name: :doc_tree_nodes_tab_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :tab_id, :type, :title],
        prefix: @prefix,
        where: "type IN ('group', 'pin') AND tab_id IS NOT NULL AND title IS NOT NULL",
        name: :doc_tree_nodes_tab_sibling_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :group_id, :slug],
        prefix: @prefix,
        where: "type IN ('page', 'link') AND group_id IS NOT NULL AND slug IS NOT NULL",
        name: :doc_tree_nodes_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :group_id, :title],
        prefix: @prefix,
        where: "type IN ('page', 'link') AND group_id IS NOT NULL AND title IS NOT NULL",
        name: :doc_tree_nodes_sibling_title_index
      )
    )
  end
end
