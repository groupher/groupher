defmodule GroupherServer.Repo.Migrations.DropArticleCommunitySlug do
  use Ecto.Migration

  @prefix "cms"
  @tables [:posts, :blogs, :changelogs, :docs]

  def change do
    for table_name <- @tables do
      alter table(table_name, prefix: @prefix) do
        remove(:community_slug, :string)
      end
    end
  end
end
