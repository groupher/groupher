defmodule GroupherServer.Repo.Migrations.RecreateCommunitiesJoinBlog do
  use Ecto.Migration

  def change do
    drop_if_exists (table(:communities_join_blogs))
    drop_if_exists (unique_index(:communities_join_blogs, [:community_id, :blog_id] ))

    create table(:communities_join_blogs) do
      add(:community_id, references(:communities, on_delete: :delete_all), null: false)
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all), null: false)
    end

    create(unique_index(:communities_join_blogs, [:community_id, :blog_id]))
  end
end
