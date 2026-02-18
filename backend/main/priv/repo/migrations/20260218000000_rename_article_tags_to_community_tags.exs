defmodule GroupherServer.Repo.Migrations.RenameArticleTagsToCommunityTags do
  use Ecto.Migration

  def change do
    rename table(:article_tags, prefix: "cms"), to: table(:community_tags, prefix: "cms")
    rename table(:articles_join_tags, prefix: "cms"), to: table(:community_join_tags, prefix: "cms")

    rename table(:community_join_tags, prefix: "cms"), :article_tag_id, to: :community_tag_id
  end
end
