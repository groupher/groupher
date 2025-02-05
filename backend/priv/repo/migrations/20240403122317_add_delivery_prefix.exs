defmodule GroupherServer.Repo.Migrations.AddDeliveryPrefix do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS delivery"

    execute "ALTER TABLE mentions SET SCHEMA delivery"
    execute "ALTER TABLE notifications SET SCHEMA delivery"
  end

  def down do
    execute "ALTER TABLE delivery.mentions SET SCHEMA public"
    execute "ALTER TABLE delivery.notifications SET SCHEMA public"

    execute "DROP SCHEMA IF EXISTS delivery"
  end
end
