defmodule GroupherServer.Repo.Migrations.AddPrefixToPosts do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS cms"
    execute "ALTER TABLE cms_posts RENAME TO posts"
    execute "ALTER TABLE public.posts SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.posts SET SCHEMA public"
    execute "ALTER TABLE public.posts RENAME TO cms_posts"
    execute "DROP SCHEMA IF EXISTS cms"
  end
end
