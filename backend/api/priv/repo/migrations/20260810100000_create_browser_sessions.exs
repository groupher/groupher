defmodule GroupherServer.Repo.Migrations.CreateBrowserSessions do
  use Ecto.Migration

  def change do
    create table(:browser_sessions, prefix: "account") do
      add(:ref, :string, null: false)
      add(:public_ref, :string, null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :delete_all), null: false)
      add(:status, :string, null: false, default: "active")
      add(:absolute_expires_at, :timestamptz, null: false)
      add(:last_refreshed_at, :timestamptz)
      add(:last_seen_at, :timestamptz)
      add(:revoked_at, :timestamptz)
      add(:revoked_reason, :string)

      add(:browser_family, :string)
      add(:os_family, :string)
      add(:device_family, :string)
      add(:user_agent_summary, :string)
      add(:created_country, :string)
      add(:created_region, :string)
      add(:created_city, :string)
      add(:last_seen_country, :string)
      add(:last_seen_region, :string)
      add(:last_seen_city, :string)

      timestamps()
    end

    create(unique_index(:browser_sessions, [:ref], prefix: "account"))
    create(unique_index(:browser_sessions, [:public_ref], prefix: "account"))
    create(index(:browser_sessions, [:user_id, :status, :absolute_expires_at], prefix: "account"))
  end
end
