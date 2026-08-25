defmodule GroupherServer.Repo.Migrations.RemoveDocTemplatesAndRenameCoverAppearance do
  use Ecto.Migration

  @prefix "cms"

  def up do
    drop_if_exists(
      unique_index(
        :doc_tree_nodes,
        [:community_id, :branch_id, :stage, :template_key],
        prefix: @prefix,
        name: :doc_tree_nodes_community_stage_template_key_index
      )
    )

    drop_if_exists(
      index(:docs, [:community_id, :template_key],
        prefix: @prefix,
        name: :docs_community_template_key_index
      )
    )

    alter table(:doc_tree_nodes, prefix: @prefix) do
      remove(:template_key, :string)
    end

    alter table(:docs, prefix: @prefix) do
      remove(:template_key, :string)
    end

    rename(table(:doc_cover_groups, prefix: @prefix), :ui_config, to: :appearance)
    rename(table(:doc_cover_items, prefix: @prefix), :ui_config, to: :appearance)
  end

  def down do
    rename(table(:doc_cover_items, prefix: @prefix), :appearance, to: :ui_config)
    rename(table(:doc_cover_groups, prefix: @prefix), :appearance, to: :ui_config)

    alter table(:docs, prefix: @prefix) do
      add(:template_key, :string)
    end

    alter table(:doc_tree_nodes, prefix: @prefix) do
      add(:template_key, :string)
    end

    create(
      index(:docs, [:community_id, :template_key],
        prefix: @prefix,
        where: "template_key IS NOT NULL",
        name: :docs_community_template_key_index
      )
    )

    create(
      unique_index(
        :doc_tree_nodes,
        [:community_id, :branch_id, :stage, :template_key],
        prefix: @prefix,
        where: "template_key IS NOT NULL",
        name: :doc_tree_nodes_community_stage_template_key_index
      )
    )
  end
end
