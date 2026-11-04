defmodule GroupherServer.Repo.Migrations.CreateProductionSeedLedger do
  use Ecto.Migration

  def change do
    create table(:production_seed_runs) do
      add(:run_id, :text, null: false)
      add(:status, :text, null: false, default: "active")
      add(:database_name, :text, null: false)
      add(:expires_at, :timestamptz, null: false)
      add(:manifest, :map, null: false, default: %{})
      timestamps()
    end

    create(unique_index(:production_seed_runs, [:run_id]))
    create(unique_index(:production_seed_runs, [:status], where: "status = 'active'"))

    create table(:production_seed_logins) do
      add(:run_id, references(:production_seed_runs, on_delete: :restrict), null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :restrict), null: false)
      add(:digest, :binary, null: false)
      add(:expires_at, :timestamptz, null: false)
      add(:consumed_at, :timestamptz)
      add(:session_ref, :text)
      timestamps()
    end

    create(unique_index(:production_seed_logins, [:digest]))
    create(index(:production_seed_logins, [:run_id]))
  end
end
