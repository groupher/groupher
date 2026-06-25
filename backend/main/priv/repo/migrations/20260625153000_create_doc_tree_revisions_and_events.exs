defmodule GroupherServer.Repo.Migrations.CreateDocTreeRevisionsAndEvents do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:doc_tree_revisions, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:revision_number, :integer, null: false)
      add(:tree_json, :map, null: false)
      add(:tree_hash, :string, null: false)
      add(:message, :text)
      add(:published_at, :timestamptz, null: false)
      add(:author_id, references(:users, prefix: "account", on_delete: :nilify_all))

      timestamps()
    end

    create(index(:doc_tree_revisions, [:community_id], prefix: @prefix))
    create(index(:doc_tree_revisions, [:tree_hash], prefix: @prefix))
    create(index(:doc_tree_revisions, [:published_at], prefix: @prefix))

    create(
      unique_index(:doc_tree_revisions, [:community_id, :revision_number],
        prefix: @prefix,
        name: :doc_tree_revisions_community_revision_index
      )
    )

    alter table(:doc_tree_draft_states, prefix: @prefix) do
      add(
        :base_revision_id,
        references(:doc_tree_revisions, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:staged_event_count, :integer, null: false, default: 0)
    end

    alter table(:doc_tree_node_drafts, prefix: @prefix) do
      modify(:title, :string, null: true)
      modify(:slug, :string, null: true)

      add(
        :target_node_id,
        references(:doc_tree_node_drafts, prefix: @prefix, on_delete: :delete_all)
      )

      add(:ui_config, :map, null: false, default: %{})
      add(:deleted_at, :timestamptz)
    end

    create(index(:doc_tree_node_drafts, [:community_id, :deleted_at], prefix: @prefix))
    create(index(:doc_tree_node_drafts, [:target_node_id], prefix: @prefix))

    alter table(:doc_tree_nodes, prefix: @prefix) do
      modify(:title, :string, null: true)
      modify(:slug, :string, null: true)
      add(:target_node_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all))
      add(:ui_config, :map, null: false, default: %{})
    end

    create(index(:doc_tree_nodes, [:target_node_id], prefix: @prefix))

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :slug],
        prefix: @prefix,
        name: :doc_tree_nodes_root_slug_index
      )
    )

    drop_if_exists(
      index(:doc_tree_nodes, [:community_id, :title],
        prefix: @prefix,
        name: :doc_tree_nodes_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NULL AND type = 'group'",
        name: :doc_tree_nodes_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :title],
        prefix: @prefix,
        where: "parent_id IS NULL AND type = 'group'",
        name: :doc_tree_nodes_root_title_index
      )
    )

    drop_if_exists(
      index(:doc_tree_node_drafts, [:community_id, :slug],
        prefix: @prefix,
        name: :doc_tree_node_drafts_root_slug_index
      )
    )

    drop_if_exists(
      index(:doc_tree_node_drafts, [:community_id, :title],
        prefix: @prefix,
        name: :doc_tree_node_drafts_root_title_index
      )
    )

    drop_if_exists(
      index(:doc_tree_node_drafts, [:community_id, :parent_id, :slug],
        prefix: @prefix,
        name: :doc_tree_node_drafts_sibling_slug_index
      )
    )

    drop_if_exists(
      index(:doc_tree_node_drafts, [:community_id, :parent_id, :title],
        prefix: @prefix,
        name: :doc_tree_node_drafts_sibling_title_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NULL AND type = 'group' AND deleted_at IS NULL",
        name: :doc_tree_node_drafts_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :title],
        prefix: @prefix,
        where: "parent_id IS NULL AND type = 'group' AND deleted_at IS NULL",
        name: :doc_tree_node_drafts_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :parent_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NOT NULL AND deleted_at IS NULL",
        name: :doc_tree_node_drafts_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :parent_id, :title],
        prefix: @prefix,
        where: "parent_id IS NOT NULL AND deleted_at IS NULL",
        name: :doc_tree_node_drafts_sibling_title_index
      )
    )

    create table(:doc_tree_events, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:seq, :integer, null: false)
      add(:event_type, :string, null: false)
      add(:payload, :map, null: false)
      add(:inverse_payload, :map, null: false)
      add(:status, :string, null: false, default: "staged")
      add(:author_id, references(:users, prefix: "account", on_delete: :nilify_all))

      add(
        :published_revision_id,
        references(:doc_tree_revisions, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :reverted_by_event_id,
        references(:doc_tree_events, prefix: @prefix, on_delete: :nilify_all)
      )

      timestamps()
    end

    create(index(:doc_tree_events, [:community_id], prefix: @prefix))
    create(index(:doc_tree_events, [:community_id, :status], prefix: @prefix))
    create(index(:doc_tree_events, [:published_revision_id], prefix: @prefix))

    create(
      unique_index(:doc_tree_events, [:community_id, :seq],
        prefix: @prefix,
        name: :doc_tree_events_community_seq_index
      )
    )

    create(
      constraint(:doc_tree_events, :doc_tree_events_status_check,
        prefix: @prefix,
        check: "status IN ('staged', 'published', 'reverted', 'discarded')"
      )
    )
  end
end
