defmodule GroupherServer.Repo.Migrations.AddXmlToArticleDocuments do
  use Ecto.Migration

  @thread_document_tables [:post_documents, :doc_documents, :changelog_documents, :blog_documents]

  def up do
    alter table(:article_documents, prefix: :cms) do
      add(:xml, :text)
    end

    Enum.each(@thread_document_tables, fn table_name ->
      alter table(table_name, prefix: :cms) do
        add(:xml, :text)
      end
    end)
  end

  def down do
    alter table(:article_documents, prefix: :cms) do
      remove(:xml, :text)
    end

    Enum.each(@thread_document_tables, fn table_name ->
      alter table(table_name, prefix: :cms) do
        remove(:xml, :text)
      end
    end)
  end
end
