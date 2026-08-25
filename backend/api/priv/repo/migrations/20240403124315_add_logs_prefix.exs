defmodule GroupherServer.Repo.Migrations.AddLogsPrefix do
  use Ecto.Migration

  # user_activities

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS log"

    execute "ALTER TABLE user_activity_logs RENAME TO user_activities"
    execute "ALTER TABLE public.user_activities SET SCHEMA log"
  end

  def down do
    execute "ALTER TABLE log.user_activities SET SCHEMA public"
    execute "ALTER TABLE user_activities RENAME TO user_activity_logs"
    execute "ALTER TABLE user_activity_logs SET SCHEMA public"

    execute "DROP SCHEMA IF EXISTS log"
  end
end
