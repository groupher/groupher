defmodule GroupherServer.Repo.Migrations.AddPrefixToCommunitiesJoinPosts do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE public.communities_join_posts SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.communities_join_posts SET SCHEMA public"
  end
end
