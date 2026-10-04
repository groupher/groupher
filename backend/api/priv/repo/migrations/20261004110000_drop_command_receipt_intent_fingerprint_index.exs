defmodule GroupherServer.Repo.Migrations.DropCommandReceiptIntentFingerprintIndex do
  use Ecto.Migration

  @index_name :command_receipts_intent_fingerprint_index

  def up do
    drop_if_exists(
      index(:command_receipts, [:intent_fingerprint],
        prefix: "cms",
        name: @index_name
      )
    )
  end

  def down do
    create(
      index(:command_receipts, [:intent_fingerprint],
        prefix: "cms",
        name: @index_name
      )
    )
  end
end
