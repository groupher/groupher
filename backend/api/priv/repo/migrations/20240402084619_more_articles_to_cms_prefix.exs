defmodule GroupherServer.Repo.Migrations.MoreArticlesToCmsPrefix do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE cms_authors RENAME TO authors"
    execute "ALTER TABLE public.authors SET SCHEMA cms"

    execute "ALTER TABLE cms_passports RENAME TO passports"
    execute "ALTER TABLE public.passports SET SCHEMA cms"

    execute "ALTER TABLE public.pinned_articles SET SCHEMA cms"
    execute "ALTER TABLE public.article_upvotes SET SCHEMA cms"
    execute "ALTER TABLE public.pinned_comments SET SCHEMA cms"
    execute "ALTER TABLE public.articles_users_emotions SET SCHEMA cms"
    execute "ALTER TABLE public.cited_artiments SET SCHEMA cms"
    execute "ALTER TABLE public.article_collects SET SCHEMA cms"
    execute "ALTER TABLE public.abuse_reports SET SCHEMA cms"
    execute "ALTER TABLE public.article_documents SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.authors SET SCHEMA public"
    execute "ALTER TABLE public.authors RENAME TO cms_authors"

    execute "ALTER TABLE cms.passports SET SCHEMA public"
    execute "ALTER TABLE public.passports RENAME TO cms_passports"

    execute "ALTER TABLE cms.pinned_articles SET SCHEMA public"
    execute "ALTER TABLE cms.article_upvotes SET SCHEMA public"
    execute "ALTER TABLE cms.pinned_comments SET SCHEMA public"
    execute "ALTER TABLE cms.articles_users_emotions SET SCHEMA public"
    execute "ALTER TABLE cms.cited_artiments SET SCHEMA public"
    execute "ALTER TABLE cms.article_collects SET SCHEMA public"
    execute "ALTER TABLE cms.abuse_reports SET SCHEMA public"
    execute "ALTER TABLE cms.article_documents SET SCHEMA public"
  end
end
