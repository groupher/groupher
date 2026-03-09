defmodule GroupherServer.Repo.Migrations.RebuildArticleDocumentsForPlateContent do
  use Ecto.Migration

  def up do
    rebuild_thread_document(:post_documents)
    rebuild_thread_document(:doc_documents)
    rebuild_thread_document(:changelog_documents)
    rebuild_thread_document(:blog_documents)

    ensure_thread_markdown_column(:post_documents)
    ensure_thread_markdown_column(:doc_documents)
    ensure_thread_markdown_column(:changelog_documents)
    ensure_thread_markdown_column(:blog_documents)

    alter table(:article_documents, prefix: :cms) do
      remove(:body, :text)
      remove(:body_html, :text)

      add(:json, :text)
      add(:markdown, :text)
      add(:markdown_toc, :map)
      add(:html, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:digest, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, default: 1, null: false)
    end
  end

  def down do
    rollback_thread_document(:post_documents)
    rollback_thread_document(:doc_documents)
    rollback_thread_document(:changelog_documents)
    rollback_thread_document(:blog_documents)

    alter table(:article_documents, prefix: :cms) do
      remove(:json, :text)
      remove(:markdown, :text)
      remove(:markdown_toc, :map)
      remove(:html, :text)
      remove(:rss, :text)
      remove(:plain_text, :text)
      remove(:digest, :text)
      remove(:content_hash, :string)
      remove(:schema_version, :integer)

      add(:body, :text)
      add(:body_html, :text)
    end
  end

  defp rebuild_thread_document(table) do
    alter table(table, prefix: :cms) do
      remove(:body, :text)
      remove(:body_html, :text)
      remove(:toc, :map)

      add(:json, :text)
      add(:markdown_toc, :map)
      add(:html, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:digest, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, default: 1, null: false)
    end
  end

  defp rollback_thread_document(table) do
    alter table(table, prefix: :cms) do
      remove(:json, :text)
      remove(:markdown_toc, :map)
      remove(:html, :text)
      remove(:rss, :text)
      remove(:plain_text, :text)
      remove(:digest, :text)
      remove(:content_hash, :string)
      remove(:schema_version, :integer)

      add(:body, :text)
      add(:body_html, :text)
      add(:toc, :map)
    end
  end

  defp ensure_thread_markdown_column(table) do
    execute("ALTER TABLE cms.#{table} ADD COLUMN IF NOT EXISTS markdown text")
  end
end
