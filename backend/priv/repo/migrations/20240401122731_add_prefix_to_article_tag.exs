defmodule GroupherServer.Repo.Migrations.AddPrefixToArticleTag do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE public.article_tags SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.article_tags SET SCHEMA public"
  end
end
