defmodule GroupherServer.Repo.Migrations.AddCmsOutboxIdentityType do
  use Ecto.Migration

  def up do
    alter table(:outbox_events, prefix: "cms") do
      add(:identity_type, :string, null: false, default: "command")
    end

    execute(
      "ALTER TABLE cms.outbox_events ALTER COLUMN command_id TYPE text USING command_id::text",
      "ALTER TABLE cms.outbox_events ALTER COLUMN command_id TYPE uuid USING command_id::uuid"
    )

    drop_if_exists(
      index(:outbox_events, [:command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )

    create(
      unique_index(
        :outbox_events,
        [:identity_type, :command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(
        :outbox_events,
        [:identity_type, :command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )

    execute(
      "ALTER TABLE cms.outbox_events ALTER COLUMN command_id TYPE uuid USING command_id::uuid",
      "ALTER TABLE cms.outbox_events ALTER COLUMN command_id TYPE text USING command_id::text"
    )

    alter table(:outbox_events, prefix: "cms") do
      remove(:identity_type)
    end

    create(
      unique_index(
        :outbox_events,
        [:command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )
  end
end
