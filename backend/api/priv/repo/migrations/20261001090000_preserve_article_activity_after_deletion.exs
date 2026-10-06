defmodule GroupherServer.Repo.Migrations.PreserveArticleActivityAfterDeletion do
  @moduledoc """
  Removes Article foreign keys from append-only Activity streams.

  A permanently deleted Article must leave its historical Activity records
  addressable by the former stable UUID.
  """

  use Ecto.Migration

  @tables ~w(post_logs blog_logs changelog_logs doc_logs)a

  def up do
    Enum.each(@tables, fn table ->
      execute("ALTER TABLE activity.#{table} DROP CONSTRAINT IF EXISTS #{table}_article_id_fkey")
    end)
  end

  def down do
    Enum.each(@tables, fn table ->
      execute("""
      DELETE FROM activity.#{table} AS log
      WHERE NOT EXISTS (
        SELECT 1 FROM cms.articles AS article WHERE article.id = log.article_id
      )
      """)

      execute("""
      ALTER TABLE activity.#{table}
      ADD CONSTRAINT #{table}_article_id_fkey
      FOREIGN KEY (article_id) REFERENCES cms.articles(id) ON DELETE CASCADE
      """)
    end)
  end
end
