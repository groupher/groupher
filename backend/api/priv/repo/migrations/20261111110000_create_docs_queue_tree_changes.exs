defmodule GroupherServer.Repo.Migrations.CreateDocsQueueTreeChanges do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:docs_queue_tree_changes, primary_key: false, prefix: @prefix) do
      add(:queue_id, :uuid, primary_key: true)
      add(:node_id, :text, primary_key: true)
      add(:community_id, :bigint, null: false)
      add(:change_kind, :text, null: false)
      add(:target, :map)
      add(:source_event_id, :bigint)
      timestamps()
    end

    create(
      constraint(:docs_queue_tree_changes, :docs_queue_tree_change_shape_check,
        check:
          "(change_kind = 'upsert' AND target IS NOT NULL AND jsonb_typeof(target) = 'object') OR (change_kind = 'delete' AND target IS NULL)",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_queue_tree_changes
      ADD CONSTRAINT docs_queue_tree_change_queue_owner_fkey
      FOREIGN KEY (queue_id, community_id)
      REFERENCES cms.docs_publish_queues(id, community_id) ON DELETE CASCADE
      """,
      "ALTER TABLE cms.docs_queue_tree_changes DROP CONSTRAINT docs_queue_tree_change_queue_owner_fkey"
    )

    create(
      constraint(:docs_queue_tree_changes, :docs_queue_tree_changes_unavailable_event_check,
        check: "source_event_id IS NULL",
        prefix: @prefix
      )
    )

    create(index(:docs_queue_tree_changes, [:source_event_id], prefix: @prefix))

    create table(:docs_queue_tree_contributors, primary_key: false, prefix: @prefix) do
      add(:queue_id, :uuid, primary_key: true)
      add(:node_id, :text, primary_key: true)
      add(:field_name, :text, primary_key: true)

      add(:user_id, references(:users, prefix: "account", on_delete: :restrict), null: false)
    end

    create(
      constraint(:docs_queue_tree_contributors, :docs_queue_tree_contributor_field_check,
        check:
          "field_name IN ('existence','parent_node_id','index','title','href','doc_id','marker','badge','hidden')",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_queue_tree_contributors
      ADD CONSTRAINT docs_queue_tree_contributor_member_fkey
      FOREIGN KEY (queue_id, node_id)
      REFERENCES cms.docs_queue_tree_changes(queue_id, node_id) ON DELETE CASCADE
      """,
      "ALTER TABLE cms.docs_queue_tree_contributors DROP CONSTRAINT docs_queue_tree_contributor_member_fkey"
    )
  end
end
