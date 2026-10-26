defmodule GroupherServer.Repo.Migrations.CreateAlertWall do
  use Ecto.Migration

  @alert_wall "alert_wall"
  @cms "cms"
  @account "account"

  def up do
    execute("CREATE SCHEMA IF NOT EXISTS #{@alert_wall}")

    create table(:items, prefix: @alert_wall) do
      add(:owner, :text, null: false)
      add(:target_type, :text, null: false)
      add(:target_id, :text, null: false)
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:subject_ref, :text, null: false)
      add(:status, :text, null: false, default: "open")
      add(:ai_source_ref, :uuid)
      add(:sus_notes, {:array, :map}, null: false, default: [])
      add(:summary, :text, null: false, default: "")
      add(:version, :bigint, null: false, default: 1)
      add(:opened_at, :timestamptz, null: false)
      add(:resolved_at, :timestamptz)
      add(:resolution, :text)
      add(:target_deleted_at, :timestamptz)
      timestamps()
    end

    create(
      constraint(:items, :alert_wall_items_owner_check,
        check: "owner IN ('cms', 'accounts')",
        prefix: @alert_wall
      )
    )

    create(
      constraint(:items, :alert_wall_items_target_type_check,
        check: "target_type IN ('article', 'comment', 'doc', 'user')",
        prefix: @alert_wall
      )
    )

    create(
      constraint(:items, :alert_wall_items_status_check,
        check: "status IN ('open', 'resolved', 'superseded')",
        prefix: @alert_wall
      )
    )

    create(
      constraint(:items, :alert_wall_items_version_check,
        check: "version > 0",
        prefix: @alert_wall
      )
    )

    create(
      unique_index(:items, [:owner, :target_type, :target_id, :community_id, :subject_ref],
        prefix: @alert_wall,
        where: "status = 'open' AND community_id IS NOT NULL",
        name: :alert_wall_items_one_open_community_index
      )
    )

    create(
      unique_index(:items, [:owner, :target_type, :target_id, :subject_ref],
        prefix: @alert_wall,
        where: "status = 'open' AND community_id IS NULL",
        name: :alert_wall_items_one_open_system_index
      )
    )

    create(index(:items, [:status, :opened_at, :id], prefix: @alert_wall))
    create(index(:items, [:owner, :target_type, :target_id], prefix: @alert_wall))

    create table(:reports, prefix: @alert_wall) do
      add(:origin_item_id, references(:items, prefix: @alert_wall, on_delete: :restrict),
        null: false
      )

      add(:reporter_id, references(:users, prefix: @account, on_delete: :restrict), null: false)
      add(:owner, :text, null: false)
      add(:target_type, :text, null: false)
      add(:target_id, :text, null: false)
      add(:community_id, references(:communities, prefix: @cms, on_delete: :restrict))
      add(:subject_ref, :text, null: false)
      add(:report_type, :text, null: false)
      add(:details, :text)
      add(:operation_ref, :uuid, null: false)
      add(:withdrawn_at, :timestamptz)
      timestamps()
    end

    create(
      unique_index(:reports, [:reporter_id, :owner, :target_type, :target_id, :community_id],
        prefix: @alert_wall,
        where: "withdrawn_at IS NULL AND community_id IS NOT NULL",
        name: :alert_wall_reports_active_community_unique
      )
    )

    create(
      unique_index(:reports, [:reporter_id, :owner, :target_type, :target_id],
        prefix: @alert_wall,
        where: "withdrawn_at IS NULL AND community_id IS NULL",
        name: :alert_wall_reports_active_system_unique
      )
    )

    create(unique_index(:reports, [:operation_ref], prefix: @alert_wall))
    create(index(:reports, [:reporter_id, :inserted_at, :id], prefix: @alert_wall))

    create table(:item_reports, prefix: @alert_wall) do
      add(:item_id, references(:items, prefix: @alert_wall, on_delete: :restrict), null: false)

      add(:report_id, references(:reports, prefix: @alert_wall, on_delete: :restrict),
        null: false
      )

      add(:linked_by_ref, :uuid, null: false)
      add(:linked_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:item_reports, [:item_id, :report_id], prefix: @alert_wall))
    create(index(:item_reports, [:report_id, :item_id], prefix: @alert_wall))

    create table(:actions, prefix: @alert_wall) do
      add(:item_id, references(:items, prefix: @alert_wall, on_delete: :restrict), null: false)
      add(:action, :text, null: false)
      add(:source, :text, null: false)
      add(:actor_id, references(:users, prefix: @account, on_delete: :nilify_all))
      add(:operation_ref, :uuid, null: false)
      add(:request_digest, :text, null: false)
      add(:result, :map)
      add(:note, :text)
      add(:resource_result_ref, :text)
      timestamps()
    end

    create(
      constraint(:actions, :alert_wall_actions_action_check,
        check: "action IN ('add', 'resolve', 'supersede')",
        prefix: @alert_wall
      )
    )

    create(
      constraint(:actions, :alert_wall_actions_source_check,
        check: "source IN ('human', 'cms', 'accounts')",
        prefix: @alert_wall
      )
    )

    create(unique_index(:actions, [:operation_ref, :action], prefix: @alert_wall))
    create(index(:actions, [:item_id, :inserted_at, :id], prefix: @alert_wall))
  end

  def down do
    drop(table(:actions, prefix: @alert_wall))
    drop(table(:item_reports, prefix: @alert_wall))
    drop(table(:reports, prefix: @alert_wall))
    drop(table(:items, prefix: @alert_wall))
  end
end
