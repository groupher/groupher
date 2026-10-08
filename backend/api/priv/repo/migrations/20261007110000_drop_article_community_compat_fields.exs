defmodule GroupherServer.Repo.Migrations.DropArticleCommunityCompatFields do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:articles, prefix: @prefix) do
      remove(:community_id)
      remove(:inner_id)
    end
  end
end
