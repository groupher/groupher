defmodule GroupherServer.Repo.Migrations.CreateActivityV3 do
  use Ecto.Migration

  @prefix "activity"
  @sources ~w(api admin worker scheduler maintenance)
  @actor_types ~w(user system)
  @outcomes ~w(allowed denied)

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
     ~w(blocker_created blocker_released blocker_terminated setup_failed setup_retried activated destroy_scheduled destroy_cancelled destroyed lifecycle_reconciled activity_exported),
     []},
    {:doc_tree_logs, :doc_tree_ref, ~w(trashed restored permanently_deleted),
     [branch_ref: :string]},
    {:press_logs, :press_ref, ~w(config_updated), []}
  ]

  def up do
    execute("CREATE SCHEMA IF NOT EXISTS #{@prefix}")
    execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    execute("CREATE SEQUENCE #{@prefix}.record_sequence")

    Enum.each(@tables, fn {table_name, stream_field, actions, extra_fields} ->
      create_activity_table(table_name, stream_field, actions, extra_fields)
    end)
  end

  def down do
    execute("DROP SCHEMA IF EXISTS #{@prefix} CASCADE")
  end

  defp create_activity_table(table_name, stream_field, actions, extra_fields) do
    create table(table_name, prefix: @prefix) do
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
      add(:actor_ref, :string, null: false)
      add(:actor_snapshot, :map, null: false, default: %{})
      add(:on_behalf_of_type, :string)
      add(:on_behalf_of_ref, :string)
      add(:on_behalf_of_snapshot, :map, null: false, default: %{})
      add(:action, :string, null: false)
      add(:outcome, :string, null: false)
      add(:denial_code, :string)
      add(:source, :string, null: false)
      add(:event_ref, :uuid, null: false)
      add(:operation_ref, :uuid, null: false)
      add(:parent_event_ref, :uuid)
      add(:operation_index, :integer, null: false)

      add(:record_sequence, :bigint,
        null: false,
        default: fragment("nextval('activity.record_sequence')")
      )

      add(:changed_fields, {:array, :string}, null: false, default: [])
      add(:payload, :map, null: false, default: %{})
      add(:metadata, :map, null: false, default: %{})
      add(:occurred_at, :timestamptz, null: false)
      add(:recorded_at, :timestamptz, null: false, default: fragment("NOW()"))
    end

    create(unique_index(table_name, [:event_ref], prefix: @prefix))
    create(index(table_name, [:operation_ref, :operation_index], prefix: @prefix))
    create(index(table_name, [:community_id, :occurred_at, :record_sequence], prefix: @prefix))
    create(index(table_name, [stream_field, :occurred_at, :record_sequence], prefix: @prefix))

    create(
      index(table_name, [:community_id, :action, :occurred_at, :record_sequence], prefix: @prefix)
    )

    create(
      index(table_name, [:community_id, :actor_type, :actor_ref, :occurred_at], prefix: @prefix)
    )

    create(
      index(table_name, [:community_id, :subject_type, :subject_ref, :occurred_at],
        prefix: @prefix
      )
    )

    create(index(table_name, [:changed_fields], prefix: @prefix, using: :gin))

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
      constraint(table_name, :"#{table_name}_outcome_check",
        prefix: @prefix,
        check: "outcome IN (#{quoted(@outcomes)})"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_outcome_denial_check",
        prefix: @prefix,
        check:
          "(outcome = 'allowed' AND denial_code IS NULL) OR (outcome = 'denied' AND denial_code IS NOT NULL)"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_target_pair_check",
        prefix: @prefix,
        check: "(target_type IS NULL) = (target_ref IS NULL)"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_on_behalf_of_pair_check",
        prefix: @prefix,
        check: "(on_behalf_of_type IS NULL) = (on_behalf_of_ref IS NULL)"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_on_behalf_of_type_check",
        prefix: @prefix,
        check: "on_behalf_of_type IS NULL OR on_behalf_of_type IN (#{quoted(@actor_types)})"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_operation_index_check",
        prefix: @prefix,
        check: "operation_index >= 0"
      )
    )

    create(
      constraint(table_name, :"#{table_name}_occurred_at_check",
        prefix: @prefix,
        check: "occurred_at <= recorded_at + interval '60 seconds'"
      )
    )
  end

  defp quoted(values), do: Enum.map_join(values, ", ", &("'" <> &1 <> "'"))
end
