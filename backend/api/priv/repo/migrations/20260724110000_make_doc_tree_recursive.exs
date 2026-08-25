defmodule GroupherServer.Repo.Migrations.MakeDocTreeRecursive do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(table(:doc_cover_groups, prefix: @prefix), to: table(:doc_cover_sections))

    rename(
      table(:doc_cover_sections, prefix: @prefix),
      :group_id,
      to: :source_node_id
    )

    rename(
      table(:doc_cover_items, prefix: @prefix),
      :cover_group_id,
      to: :cover_section_id
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_groups_community_group_index RENAME TO doc_cover_sections_community_source_node_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_items_cover_group_node_index RENAME TO doc_cover_items_cover_section_node_index"
    )

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_title_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_tab_sibling_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_tab_sibling_title_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_title_index";|)

    alter table(:doc_tree_nodes, prefix: @prefix) do
      add(:parent_node_id, :string)
    end

    execute("""
    UPDATE #{@prefix}.doc_tree_nodes
    SET parent_node_id = COALESCE(group_id, tab_id)
    """)

    alter table(:doc_tree_nodes, prefix: @prefix) do
      remove(:tab_id, :string)
      remove(:group_id, :string)
      remove(:slug, :string)
      remove(:ui_config, :map)
    end

    execute("""
    COMMENT ON COLUMN #{@prefix}.doc_tree_nodes.id IS
      'Physical database row id. Product code must use node_id for tree identity.'
    """)

    execute("""
    COMMENT ON COLUMN #{@prefix}.doc_tree_nodes.node_id IS
      'Stable logical node identity shared by draft and public stages.'
    """)

    execute("""
    COMMENT ON COLUMN #{@prefix}.doc_tree_nodes.parent_node_id IS
      'Immediate parent logical node_id in the same community, branch, and stage; not a physical row id. NULL only for root tabs.'
    """)

    create(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :parent_node_id],
        prefix: @prefix,
        name: :doc_tree_nodes_parent_node_id_index
      )
    )

    create(
      unique_index(
        :doc_tree_nodes,
        [:community_id, :branch_id, :stage, :parent_node_id, :title],
        prefix: @prefix,
        where: "parent_node_id IS NOT NULL AND type != 'pin'",
        name: :doc_tree_nodes_navigation_sibling_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :title],
        prefix: @prefix,
        where: "parent_node_id IS NULL AND type = 'tab'",
        name: :doc_tree_nodes_root_tab_title_index
      )
    )

    create(
      unique_index(
        :doc_tree_nodes,
        [:community_id, :branch_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        where: "parent_node_id IS NOT NULL AND type != 'pin'",
        name: :doc_tree_nodes_navigation_sibling_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :index],
        prefix: @prefix,
        where: "parent_node_id IS NULL AND type = 'tab'",
        name: :doc_tree_nodes_root_tab_index
      )
    )

    create(
      unique_index(
        :doc_tree_nodes,
        [:community_id, :branch_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        where: "type = 'pin'",
        name: :doc_tree_nodes_pin_sibling_index
      )
    )

    execute("""
    ALTER TABLE #{@prefix}.doc_tree_nodes
    ADD CONSTRAINT doc_tree_nodes_parent_node_fk
    FOREIGN KEY (community_id, branch_id, stage, parent_node_id)
    REFERENCES #{@prefix}.doc_tree_nodes (community_id, branch_id, stage, node_id)
    DEFERRABLE INITIALLY DEFERRED
    """)

    create(
      constraint(:doc_tree_nodes, :doc_tree_nodes_shape_check,
        prefix: @prefix,
        check: """
        (type = 'tab' AND parent_node_id IS NULL AND doc_id IS NULL AND href IS NULL)
        OR (type = 'group' AND parent_node_id IS NOT NULL AND doc_id IS NULL AND href IS NULL)
        OR (type = 'page' AND parent_node_id IS NOT NULL AND doc_id IS NOT NULL AND href IS NULL)
        OR (type IN ('link', 'pin') AND parent_node_id IS NOT NULL AND doc_id IS NULL AND href IS NOT NULL)
        """
      )
    )
  end

  def down do
    drop_if_exists(constraint(:doc_tree_nodes, :doc_tree_nodes_shape_check, prefix: @prefix))

    execute("""
    ALTER TABLE #{@prefix}.doc_tree_nodes
    DROP CONSTRAINT IF EXISTS doc_tree_nodes_parent_node_fk
    """)

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        name: :doc_tree_nodes_navigation_sibling_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :index],
        prefix: @prefix,
        name: :doc_tree_nodes_root_tab_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        name: :doc_tree_nodes_pin_sibling_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :parent_node_id],
        prefix: @prefix,
        name: :doc_tree_nodes_parent_node_id_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :parent_node_id, :title],
        prefix: @prefix,
        name: :doc_tree_nodes_navigation_sibling_title_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :title],
        prefix: @prefix,
        name: :doc_tree_nodes_root_tab_title_index
      )
    )

    alter table(:doc_tree_nodes, prefix: @prefix) do
      add(:tab_id, :string)
      add(:group_id, :string)
      add(:slug, :string)
      add(:ui_config, :map, default: %{}, null: false)
    end

    execute("""
    UPDATE #{@prefix}.doc_tree_nodes
    SET
      tab_id = CASE WHEN type IN ('group', 'pin') THEN parent_node_id END,
      group_id = CASE WHEN type IN ('page', 'link') THEN parent_node_id END
    """)

    alter table(:doc_tree_nodes, prefix: @prefix) do
      remove(:parent_node_id, :string)
    end

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_items_cover_section_node_index RENAME TO doc_cover_items_cover_group_node_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_sections_community_source_node_index RENAME TO doc_cover_groups_community_group_index"
    )

    rename(
      table(:doc_cover_items, prefix: @prefix),
      :cover_section_id,
      to: :cover_group_id
    )

    rename(
      table(:doc_cover_sections, prefix: @prefix),
      :source_node_id,
      to: :group_id
    )

    rename(table(:doc_cover_sections, prefix: @prefix), to: table(:doc_cover_groups))
  end
end
