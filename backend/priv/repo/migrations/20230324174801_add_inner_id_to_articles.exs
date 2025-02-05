defmodule GroupherServer.Repo.Migrations.AddInnerIdToArticles do
  use Ecto.Migration

  def change do
    alter table(:cms_posts) do
      add(:inner_id, :id)
    end

    alter table(:cms_blogs) do
      add(:inner_id, :id)
    end

    alter table(:cms_changelogs) do
      add(:inner_id, :id)
    end

    alter table(:cms_docs) do
      add(:inner_id, :id)
    end

    create(unique_index(:cms_posts, [:original_community_id, :inner_id]))
    create(unique_index(:cms_blogs, [:original_community_id, :inner_id]))
    create(unique_index(:cms_changelogs, [:original_community_id, :inner_id]))
    create(unique_index(:cms_docs, [:original_community_id, :inner_id]))
  end
end
