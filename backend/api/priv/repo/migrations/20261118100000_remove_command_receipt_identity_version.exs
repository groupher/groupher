defmodule GroupherServer.Repo.Migrations.RemoveCommandReceiptIdentityVersion do
  use Ecto.Migration

  def change do
    drop(constraint(:command_receipts, :command_receipts_identity_version_check, prefix: "cms"))

    alter table(:command_receipts, prefix: "cms") do
      remove(:identity_version)
    end
  end
end
