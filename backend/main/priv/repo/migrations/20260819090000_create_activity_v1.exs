defmodule GroupherServer.Repo.Migrations.CreateActivityV1 do
  use Ecto.Migration

  @prefix "activity"
  @sources ~w(api admin worker scheduler maintenance)
  @actor_types ~w(user system)

  @tables [
    {:post_logs, :post_ref,
     ~w(created title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated comment_pinned comment_unpinned solution_accepted solution_replaced solution_revoked moderation_review_started moderation_review_resolved),
     []},
    {:blog_logs, :blog_ref,
     ~w(created title_changed body_updated trashed restored archived permanently_deleted comment_created comment_updated moderation_review_started moderation_review_resolved),
     []},
    {:changelog_logs, :changelog_ref,
     ~w(created title_changed body_updated released release_rescheduled release_withdrawn trashed restored archived permanently_deleted comment_created comment_updated moderation_review_started moderation_review_resolved),
     []},
    {:doc_logs, :doc_ref,
     ~w(created title_changed body_updated draft_updated published publish_restored trashed restored archived permanently_deleted comment_created comment_updated moderation_review_started moderation_review_resolved),
     [branch_ref: :string]},
    {:community_logs, :community_ref,
     ~w(blocker_created blocker_released blocker_terminated setup_failed setup_retried activated destroy_scheduled destroy_cancelled destroyed lifecycle_reconciled),
     []},
    {:doc_tree_logs, :doc_tree_ref, ~w(trashed restored permanently_deleted),
     [branch_ref: :string]},
    {:press_logs, :press_ref, ~w(config_updated), []}
  ]

  def up do
    execute("CREATE SCHEMA IF NOT EXISTS #{@prefix}")
    execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    Enum.each(@tables, fn {table_name, stream_field, actions, extra_fields} ->
      create_activity_table(table_name, stream_field, actions, extra_fields)
    end)
  end

  def down do
    execute("DROP SCHEMA IF EXISTS #{@prefix} CASCADE")
  end

  defp create_activity_table(table_name, stream_field, actions, extra_fields) do
    create table(table_name, prefix: @prefix) do
      add(:hash_id, :uuid, null: false, default: fragment("gen_random_uuid()"))
      add(:community_id, :bigint, null: false)
      add(stream_field, :string, null: false)

      Enum.each(extra_fields, fn {name, type} -> add(name, type) end)

      add(:stream_snapshot, :map, null: false, default: %{})
      add(:subject_type, :string, null: false)
      add(:subject_ref, :string, null: false)
      add(:subject_snapshot, :map, null: false, default: %{})
      add(:target_type, :string)
      add(:target_ref, :string)
      add(:target_snapshot, :map, null: false, default: %{})
      add(:actor_type, :string, null: false)
      add(:actor_id, :bigint)
      add(:actor_snapshot, :map, null: false, default: %{})
      add(:action, :string, null: false)
      add(:source, :string, null: false)
      add(:event_ref, :uuid, null: false)
      add(:operation_ref, :uuid, null: false)
      add(:causation_ref, :uuid)
      add(:correlation_ref, :uuid)
      add(:changes, :map, null: false, default: %{})
      add(:metadata, :map, null: false, default: %{})
      add(:occurred_at, :timestamptz, null: false)
      add(:inserted_at, :timestamptz, null: false, default: fragment("NOW()"))
    end

    create(unique_index(table_name, [:hash_id], prefix: @prefix))
    create(unique_index(table_name, [:event_ref], prefix: @prefix))
    create(index(table_name, [:operation_ref], prefix: @prefix))
    create(index(table_name, [:community_id, :occurred_at, :id], prefix: @prefix))
    create(index(table_name, [stream_field, :occurred_at, :id], prefix: @prefix))

    create(
      constraint(table_name, :"#{table_name}_action_check",
        prefix: @prefix,
        check: "action IN (#{quoted(actions)})"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_source_check",
        prefix: @prefix,
        check: "source IN (#{quoted(@sources)})"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_actor_type_check",
        prefix: @prefix,
        check: "actor_type IN (#{quoted(@actor_types)})"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_target_pair_check",
        prefix: @prefix,
        check: "(target_type IS NULL) = (target_ref IS NULL)"
      )
    )
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
