defmodule GroupherServer.Repo.Migrations.GrantTicketSourceWriterSchemaUsage do
  use Ecto.Migration

  def up do
    execute("GRANT USAGE ON SCHEMA cms TO cms_ticket_write")
  end

  def down do
    execute("REVOKE USAGE ON SCHEMA cms FROM cms_ticket_write")
  end
end
