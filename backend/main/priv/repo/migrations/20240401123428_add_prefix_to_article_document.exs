defmodule GroupherServer.Repo.Migrations.AddPrefixToArticleDocument do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE post_documents SET SCHEMA cms"
    execute "ALTER TABLE blog_documents SET SCHEMA cms"
    execute "ALTER TABLE changelog_documents SET SCHEMA cms"
    execute "ALTER TABLE doc_contents SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE post_documents SET SCHEMA public"
    execute "ALTER TABLE blog_documents SET SCHEMA public"
    execute "ALTER TABLE changelog_documents SET SCHEMA public"
    execute "ALTER TABLE doc_contents SET SCHEMA public"
  end
end
