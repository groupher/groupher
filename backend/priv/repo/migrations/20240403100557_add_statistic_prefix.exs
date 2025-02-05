defmodule GroupherServer.Repo.Migrations.AddStatisticPrefix do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS statistics"

    execute "ALTER TABLE account.contributes SET SCHEMA public"
    execute "ALTER TABLE contributes RENAME TO user_contributes"
    execute "ALTER TABLE public.user_contributes SET SCHEMA statistics"
  end

  def down do
    execute "ALTER TABLE statistics.user_contributes SET SCHEMA public"

    execute "ALTER TABLE user_contributes RENAME TO contributes"
    execute "ALTER TABLE contributes SET SCHEMA account"

    execute "DROP SCHEMA IF EXISTS statistics"
  end
end
