defmodule GroupherServer.Repo.Migrations.DropLegacyUserActivities do
  use Ecto.Migration

  @moduledoc """
  Removes the unused pre-Activity user activity table.

  Repository inspection found no producer or reader for this table. Its rows
  are intentionally destroyed rather than exposed through Activity or retained
  as an application-readable cold archive.
  """

  def up do
    drop_if_exists(table(:user_activities, prefix: "log"))
  end

  def down do
    raise "log.user_activities was intentionally retired and cannot be restored by migration"
  end
end
