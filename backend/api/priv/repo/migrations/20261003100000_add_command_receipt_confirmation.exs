defmodule GroupherServer.Repo.Migrations.AddCommandReceiptConfirmation do
  use Ecto.Migration

  def change do
    alter table(:command_receipts, prefix: "cms") do
      add(:intent_fingerprint, :string)
      add(:confirmation, :map)
    end

    execute(
      "UPDATE cms.command_receipts SET intent_fingerprint = payload_fingerprint " <>
        "WHERE intent_fingerprint IS NULL",
      "UPDATE cms.command_receipts SET payload_fingerprint = intent_fingerprint " <>
        "WHERE payload_fingerprint IS NULL"
    )

    create(index(:command_receipts, [:intent_fingerprint], prefix: "cms"))
  end
end
