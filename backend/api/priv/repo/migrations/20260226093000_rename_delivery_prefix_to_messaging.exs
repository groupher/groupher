defmodule GroupherServer.Repo.Migrations.RenameDeliveryPrefixToMessaging do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS messaging"

    execute "ALTER TABLE IF EXISTS delivery.mentions SET SCHEMA messaging"
    execute "ALTER TABLE IF EXISTS delivery.notifications SET SCHEMA messaging"

    execute "DROP SCHEMA IF EXISTS delivery"
  end

  def down do
    execute "CREATE SCHEMA IF NOT EXISTS delivery"

    execute "ALTER TABLE IF EXISTS messaging.mentions SET SCHEMA delivery"
    execute "ALTER TABLE IF EXISTS messaging.notifications SET SCHEMA delivery"

    execute "DROP SCHEMA IF EXISTS messaging"
  end
end
