defmodule GroupherServer.Repo.Migrations.AddPrefixToBiils do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS payment"

    execute "ALTER TABLE bill_records RENAME TO bills"
    execute "ALTER TABLE public.bills SET SCHEMA payment"
  end

  def down do
    execute "ALTER TABLE payment.bills SET SCHEMA public"
    execute "ALTER TABLE public.bills RENAME TO bill_records"

    execute "DROP SCHEMA IF EXISTS payment"
  end
end
