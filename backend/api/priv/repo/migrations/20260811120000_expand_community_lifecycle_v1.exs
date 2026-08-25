defmodule GroupherServer.Repo.Migrations.ExpandCommunityLifecycleV1 do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    alter table(:community_lifecycles, prefix: @cms_prefix) do
      modify(:application_id, :integer, null: true)

      add(:changed_at, :timestamptz)
      add(:archived_at, :timestamptz)
      add(:scheduled_reclaim_at, :timestamptz)
      add(:destroyed_at, :timestamptz)
    end

    drop(constraint(:community_lifecycles, :community_lifecycles_state_check, prefix: @cms_prefix))

    create(
      constraint(:community_lifecycles, :community_lifecycles_state_check,
        prefix: @cms_prefix,
        check:
          "state IN ('setting_up', 'setup_failed', 'active', 'read_only', 'suspended', 'archived', 'scheduled_reclaim', 'destroy')"
      )
    )

    execute("""
    INSERT INTO #{@cms_prefix}.community_lifecycles (community_id, state, version, changed_at, inserted_at, updated_at)
    SELECT c.id,
           CASE WHEN c.pending = 0 THEN 'active' ELSE 'setting_up' END,
           1,
           NOW(),
           NOW(),
           NOW()
    FROM #{@cms_prefix}.communities AS c
    LEFT JOIN #{@cms_prefix}.community_lifecycles AS lifecycle
      ON lifecycle.community_id = c.id
    WHERE lifecycle.id IS NULL
    """)

    create table(:community_lifecycle_blockers, prefix: @cms_prefix) do
      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :restrict), null: false)
      add(:lifecycle_id, references(:community_lifecycles, prefix: @cms_prefix, on_delete: :delete_all), null: false)
      add(:blocker_type, :string, null: false)
      add(:cause_code, :string, null: false)
      add(:cause_ref, :string)
      add(:recover_until, :timestamptz)
      add(:applied_at, :timestamptz, null: false)
      add(:ended_at, :timestamptz)
      add(:end_type, :string)
      add(:created_by_operation_ref, :string, null: false)
      add(:ended_by_operation_ref, :string)
      add(:version, :integer, null: false, default: 1)
      timestamps()
    end

    create(index(:community_lifecycle_blockers, [:community_id, :ended_at], prefix: @cms_prefix))
    create(index(:community_lifecycle_blockers, [:blocker_type, :cause_ref], prefix: @cms_prefix))

    create(
      unique_index(:community_lifecycle_blockers, [:community_id, :blocker_type],
        prefix: @cms_prefix,
        where: "ended_at IS NULL AND cause_ref IS NULL",
        name: :community_lifecycle_blockers_active_unique
      )
    )

    create(
      unique_index(:community_lifecycle_blockers, [:community_id, :blocker_type, :cause_ref],
        prefix: @cms_prefix,
        where: "ended_at IS NULL AND cause_ref IS NOT NULL",
        name: :community_lifecycle_blockers_active_cause_unique
      )
    )

    create(
      constraint(:community_lifecycle_blockers, :community_lifecycle_blockers_type_check,
        prefix: @cms_prefix,
        check:
          "blocker_type IN ('owner_archive', 'moderation_suspend', 'moderation_archive', 'ops_legal_hold', 'billing_read_only', 'billing_suspend')"
      )
    )

    create(
      constraint(:community_lifecycle_blockers, :community_lifecycle_blockers_end_type_check,
        prefix: @cms_prefix,
        check: "end_type IS NULL OR end_type IN ('released', 'terminated')"
      )
    )
  end

  def down do
    drop(table(:community_lifecycle_blockers, prefix: @cms_prefix))

    drop(constraint(:community_lifecycles, :community_lifecycles_state_check, prefix: @cms_prefix))

    create(
      constraint(:community_lifecycles, :community_lifecycles_state_check,
        prefix: @cms_prefix,
        check: "state IN ('setting_up', 'active', 'setup_failed')"
      )
    )

    alter table(:community_lifecycles, prefix: @cms_prefix) do
      remove(:destroyed_at)
      remove(:scheduled_reclaim_at)
      remove(:archived_at)
      remove(:changed_at)
      modify(:application_id, :integer, null: false)
    end
  end
end
