defmodule GroupherServer.Repo.Migrations.AddCommandReceiptIdentityRetention do
  use Ecto.Migration

  @identity_retention_days 30

  def up do
    alter table(:command_receipts, prefix: "cms") do
      add(:identity_expires_at, :timestamptz)
    end

    execute(
      "UPDATE cms.command_receipts " <>
        "SET identity_expires_at = expires_at + interval '#{@identity_retention_days} days' " <>
        "WHERE identity_expires_at IS NULL"
    )

    create(index(:command_receipts, [:identity_expires_at], prefix: "cms"))
  end

  def down do
    drop_if_exists(index(:command_receipts, [:identity_expires_at], prefix: "cms"))

    alter table(:command_receipts, prefix: "cms") do
      remove(:identity_expires_at)
    end
  end
end
