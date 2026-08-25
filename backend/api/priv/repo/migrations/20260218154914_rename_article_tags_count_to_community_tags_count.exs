defmodule GroupherServer.Repo.Migrations.RenameArticleTagsCountToCommunityTagsCount do
  use Ecto.Migration

  def change do
    rename(table(:communities, prefix: "cms"), :article_tags_count, to: :community_tags_count)
  end
end
