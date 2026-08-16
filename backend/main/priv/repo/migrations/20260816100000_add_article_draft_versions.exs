defmodule GroupherServer.Repo.Migrations.AddArticleDraftVersions do
  use Ecto.Migration

  @prefix "cms"
  @article_tables [:posts, :blogs, :changelogs, :docs]

  def change do
    for table <- @article_tables do
      alter table(table, prefix: @prefix) do
        add(:version, :integer, null: false, default: 1)
      end
    end
  end
end
