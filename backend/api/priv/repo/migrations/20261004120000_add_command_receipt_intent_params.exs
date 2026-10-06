defmodule GroupherServer.Repo.Migrations.AddCommandReceiptIntentParams do
  use Ecto.Migration

  def up do
    alter table(:command_receipts, prefix: "cms") do
      add(:intent_params, :map)
    end
  end

  def down do
    alter table(:command_receipts, prefix: "cms") do
      remove(:intent_params)
    end
  end
end
