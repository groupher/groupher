defmodule GroupherServer.Repo.Migrations.CreateDocCoverTablesAndPublishMappings do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:doc_tree_node_publish_mappings, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :draft_node_id,
        references(:doc_tree_node_drafts, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :published_node_id,
        references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:draft_doc_id, references(:article_drafts, prefix: @prefix, on_delete: :nilify_all))
      add(:published_doc_id, references(:docs, prefix: @prefix, on_delete: :nilify_all))

      add(:draft_node_updated_at, :timestamptz)
      add(:draft_doc_content_hash, :string)
      add(:visibility, :string, null: false, default: "public")
      add(:last_published_at, :timestamptz)
      add(:last_moved_to_draft_at, :timestamptz)

      timestamps()
    end

    create(index(:doc_tree_node_publish_mappings, [:community_id], prefix: @prefix))
    create(index(:doc_tree_node_publish_mappings, [:community_id, :visibility], prefix: @prefix))
    create(index(:doc_tree_node_publish_mappings, [:draft_node_id], prefix: @prefix))
    create(index(:doc_tree_node_publish_mappings, [:published_node_id], prefix: @prefix))

    create(
      unique_index(:doc_tree_node_publish_mappings, [:community_id, :draft_node_id],
        prefix: @prefix,
        name: :doc_tree_node_publish_mappings_draft_index
      )
    )

    create(
      unique_index(:doc_tree_node_publish_mappings, [:community_id, :published_node_id],
        prefix: @prefix,
        name: :doc_tree_node_publish_mappings_published_index
      )
    )

    create table(:doc_cover_groups, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:group_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:index, :integer, null: false, default: 0)
      add(:ui_config, :map, null: false, default: %{})

      timestamps()
    end

    create(index(:doc_cover_groups, [:community_id], prefix: @prefix))
    create(index(:doc_cover_groups, [:group_id], prefix: @prefix))

    create(
      unique_index(:doc_cover_groups, [:community_id, :group_id],
        prefix: @prefix,
        name: :doc_cover_groups_community_group_index
      )
    )

    create table(:doc_cover_items, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:cover_group_id, references(:doc_cover_groups, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:node_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:index, :integer, null: false, default: 0)
      add(:hidden, :boolean, null: false, default: false)
      add(:ui_config, :map, null: false, default: %{})

      timestamps()
    end

    create(index(:doc_cover_items, [:community_id], prefix: @prefix))
    create(index(:doc_cover_items, [:cover_group_id], prefix: @prefix))
    create(index(:doc_cover_items, [:node_id], prefix: @prefix))

    create(
      unique_index(:doc_cover_items, [:cover_group_id, :node_id],
        prefix: @prefix,
        name: :doc_cover_items_cover_group_node_index
      )
    )

    create table(:doc_cover_pinned_items, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:node_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:index, :integer, null: false, default: 0)
      add(:ui_config, :map, null: false, default: %{})

      timestamps()
    end

    create(index(:doc_cover_pinned_items, [:community_id], prefix: @prefix))
    create(index(:doc_cover_pinned_items, [:node_id], prefix: @prefix))

    create(
      unique_index(:doc_cover_pinned_items, [:community_id, :node_id],
        prefix: @prefix,
        name: :doc_cover_pinned_items_community_node_index
      )
    )
  end
end
