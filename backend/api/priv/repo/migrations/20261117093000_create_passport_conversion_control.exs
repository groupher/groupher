defmodule GroupherServer.Repo.Migrations.CreatePassportConversionControl do
  use Ecto.Migration

  def change do
    create table(:passport_conversion_control, primary_key: false, prefix: "cms") do
      add(:id, :integer, primary_key: true)
      add(:state, :text, null: false, default: "open")
    end

    create(
      constraint(:passport_conversion_control, :passport_conversion_control_singleton,
        prefix: "cms",
        check: "id = 1 AND state IN ('open', 'closed')"
      )
    )

    execute(
      "INSERT INTO cms.passport_conversion_control (id, state) VALUES (1, 'open')",
      "DELETE FROM cms.passport_conversion_control WHERE id = 1"
    )

    create table(:passport_conversion_runs, primary_key: false, prefix: "cms") do
      add(:user_id, references(:users, prefix: "account", on_delete: :restrict),
        primary_key: true
      )

      add(:completed_at, :timestamptz, null: false)
    end
  end
end
