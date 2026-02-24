defmodule GroupherServer.Repo.Migrations.AddPrefixToBlogChangelogDoc do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE cms_blogs RENAME TO blogs"
    execute "ALTER TABLE public.blogs SET SCHEMA cms"

    execute "ALTER TABLE cms_changelogs RENAME TO changelogs"
    execute "ALTER TABLE public.changelogs SET SCHEMA cms"

    execute "ALTER TABLE cms_docs RENAME TO docs"
    execute "ALTER TABLE public.docs SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.blogs SET SCHEMA public"
    execute "ALTER TABLE public.blogs RENAME TO cms_blogs"

    execute "ALTER TABLE cms.changelogs SET SCHEMA public"
    execute "ALTER TABLE public.changelogs RENAME TO cms_changelos"

    execute "ALTER TABLE cms.docs SET SCHEMA public"
    execute "ALTER TABLE public.docs RENAME TO cms_docs"
  end
end
