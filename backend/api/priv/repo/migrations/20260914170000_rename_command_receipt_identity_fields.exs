defmodule GroupherServer.Repo.Migrations.RenameCommandReceiptIdentityFields do
  use Ecto.Migration

  def change do
    receipts = table(:command_receipts, prefix: "cms")

    rename(receipts, :command_key, to: :command_id)
    rename(receipts, :command_name, to: :command)

    execute(
      "ALTER INDEX cms.command_receipts_initiator_command_key_index " <>
        "RENAME TO command_receipts_initiator_command_id_index",
      "ALTER INDEX cms.command_receipts_initiator_command_id_index " <>
        "RENAME TO command_receipts_initiator_command_key_index"
    )
  end
end
