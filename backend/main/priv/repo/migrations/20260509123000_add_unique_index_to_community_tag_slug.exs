defmodule GroupherServer.Repo.Migrations.AddUniqueIndexToCommunityTagSlug do
  use Ecto.Migration

  def change do
    create(
      unique_index(:community_tags, [:community_id, :thread, :slug],
        prefix: "cms",
        name: :community_tags_community_id_thread_slug_index
      )
    )
  end
end
