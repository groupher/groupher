defmodule GroupherServer.Repo.Migrations.DropXmlRssFromArticleDocuments do
  use Ecto.Migration

  def up do
    alter table(:article_documents, prefix: :cms) do
      remove(:xml, :text)
      remove(:rss, :text)
    end
  end

  def down do
    alter table(:article_documents, prefix: :cms) do
      add(:xml, :text)
      add(:rss, :text)
    end
  end
end
