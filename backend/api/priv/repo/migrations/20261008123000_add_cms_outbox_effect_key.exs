defmodule GroupherServer.Repo.Migrations.AddCmsOutboxEffectKey do
  use Ecto.Migration

  def up do
    alter table(:outbox_events, prefix: "cms") do
      add(:effect_key, :string, null: false, default: "default")
    end

    drop_if_exists(
      index(:outbox_events, [:command_id, :event, :resource_type, :resource_id],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )

    create(
      unique_index(
        :outbox_events,
        [:command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(:outbox_events, [:command_id, :event, :resource_type, :resource_id, :effect_key],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )

    create(
      unique_index(
        :outbox_events,
        [:command_id, :event, :resource_type, :resource_id],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )

    alter table(:outbox_events, prefix: "cms") do
      remove(:effect_key)
    end
  end
end
