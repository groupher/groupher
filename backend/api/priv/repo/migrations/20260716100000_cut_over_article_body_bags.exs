defmodule GroupherServer.Repo.Migrations.CutOverArticleBodyBags do
  use Ecto.Migration

  @moduledoc """
  Renames the two distinct Article hashes and gives Snapshots a restorable
  BodyBag. The application is not live, so this is an intentional one-way
  contract cutover with no raw-body compatibility path.
  """

  @prefix "cms"
  @article_tables ~w(posts blogs changelogs docs)a

  def up do
    Enum.each(@article_tables, fn table_name ->
      rename(table(table_name, prefix: @prefix), :content_hash, to: :body_hash)
    end)

    rename(table(:article_documents, prefix: @prefix), :content_hash, to: :body_hash)
    rename(table(:article_snapshots, prefix: @prefix), :content_hash, to: :version_hash)

    alter table(:article_snapshots, prefix: @prefix) do
      add(:body_bag, :map, null: false, default: %{})
    end

    execute("DROP INDEX IF EXISTS #{@prefix}.article_snapshots_content_hash_index;")
    create(index(:article_snapshots, [:version_hash], prefix: @prefix))
  end

  def down do
    raise "CutOverArticleBodyBags is intentionally irreversible"
  end
end
