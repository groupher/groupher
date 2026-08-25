defmodule GroupherServer.Repo.Migrations.AddStatisticPrefix2 do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE public.community_contributes SET SCHEMA statistics"
    execute "ALTER TABLE public.publish_throttles SET SCHEMA statistics"
  end

  def down do
    execute "ALTER TABLE statistics.community_contributes SET SCHEMA public"
    execute "ALTER TABLE statistics.publish_throttles SET SCHEMA public"
  end
end
