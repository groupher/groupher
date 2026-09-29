defmodule GroupherServer.Repo.Migrations.CreateCommandReceipts do
  use Ecto.Migration

  def change do
    drop_if_exists(table(:interaction_operation_receipts, prefix: "cms"))

    create table(:command_receipts, prefix: "cms") do
      add(:initiator_type, :string, null: false)
      add(:initiator_key, :string, null: false)
      add(:command_key, :uuid, null: false)
      add(:command_name, :string, null: false)
      add(:target_type, :string, null: false)
      add(:target_key, :string, null: false)
      add(:payload_fingerprint, :string, null: false)
      add(:outcome, :string)
      add(:result_key, :string)
      add(:result_payload, :map)
      add(:expires_at, :timestamptz, null: false)

      timestamps()
    end

    create(
      unique_index(:command_receipts, [:initiator_type, :initiator_key, :command_key],
        prefix: "cms",
        name: :command_receipts_initiator_command_key_index
      )
    )

    create(index(:command_receipts, [:expires_at], prefix: "cms"))
    create(index(:command_receipts, [:target_type, :target_key], prefix: "cms"))
  end
end
