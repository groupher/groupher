defmodule GroupherServer.Repo.Migrations.RenameCommandReceiptTargetFields do
  use Ecto.Migration

  def change do
    receipts = table(:command_receipts, prefix: "cms")

    rename(receipts, :target_type, to: :resource_type)
    rename(receipts, :target_key, to: :resource_id)
  end
end
