defmodule GroupherServer.Repo.Migrations.DropPaymentAndCustomization do
  use Ecto.Migration

  @moduledoc """
  Removes obsolete payment/customization storage.

  This migration is intentionally one-way: the deleted rows are not archived,
  so rollback cannot restore billing/customization data safely.
  """

  def up do
    drop_if_exists table(:bills, prefix: "payment")
    execute "DROP SCHEMA IF EXISTS payment"

    drop_if_exists table(:customizations, prefix: "account")
    drop_if_exists table(:purchases)
  end

  def down, do: raise(Ecto.MigrationError, "irreversible migration: payment/customization data removed")
end
