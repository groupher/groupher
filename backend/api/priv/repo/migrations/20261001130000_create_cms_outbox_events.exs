defmodule GroupherServer.Repo.Migrations.CreateCmsOutboxEvents do
  use Ecto.Migration

  def change do
    create table(:outbox_events, prefix: "cms", primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:event, :string, null: false)
      add(:contract_version, :smallint, null: false, default: 1)
      add(:resource_type, :string, null: false)
      add(:resource_id, :string, null: false)
      add(:command_id, :uuid, null: false)
      add(:data, :map, null: false, default: %{})
      add(:status, :string, null: false, default: "pending")
      add(:attempts, :integer, null: false, default: 0)
      add(:available_at, :timestamptz, null: false)
      add(:locked_at, :timestamptz)
      add(:locked_by, :string)
      add(:completed_at, :timestamptz)
      add(:last_error_code, :string)
      add(:last_error_at, :timestamptz)

      timestamps()
    end

    create(index(:outbox_events, [:status, :available_at], prefix: "cms"))

    create(
      unique_index(
        :outbox_events,
        [:command_id, :event, :resource_type, :resource_id],
        prefix: "cms",
        name: :outbox_events_command_event_resource_index
      )
    )
  end
end
