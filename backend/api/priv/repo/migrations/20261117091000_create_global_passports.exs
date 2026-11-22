defmodule GroupherServer.Repo.Migrations.CreateGlobalPassports do
  use Ecto.Migration

  def change do
    create table(:global_passports, prefix: "cms", primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:user_id, references(:users, prefix: "account", on_delete: :restrict), null: false)
      add(:is_root, :boolean, null: false, default: false)
      add(:permissions, :map, null: false, default: %{})
      add(:revision, :bigint, null: false, default: 1)
      timestamps()
    end

    create(unique_index(:global_passports, [:user_id], prefix: "cms"))

    create(
      constraint(:global_passports, :global_passports_revision_check,
        prefix: "cms",
        check: "revision > 0"
      )
    )
  end
end
