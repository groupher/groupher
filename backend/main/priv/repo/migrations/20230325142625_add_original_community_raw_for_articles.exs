defmodule GroupherServer.Repo.Migrations.AddOriginalCommunityRawToArticles do
  use Ecto.Migration

  def change do
    alter table(:cms_posts) do
      add(:original_community_raw, :string)
    end

    alter table(:cms_blogs) do
      add(:original_community_raw, :string)
    end

    alter table(:cms_changelogs) do
      add(:original_community_raw, :string)
    end

    alter table(:cms_docs) do
      add(:original_community_raw, :string)
    end


    # drop(unique_index(:cms_posts, [:original_community_id, :inner_id]))
    # drop(unique_index(:cms_blogs, [:original_community_id, :inner_id]))
    # drop(unique_index(:cms_changelogs, [:original_community_id, :inner_id]))
    # drop(unique_index(:cms_docs, [:original_community_id, :inner_id]))

    create(unique_index(:cms_posts, [:original_community_raw, :inner_id]))
    create(unique_index(:cms_blogs, [:original_community_raw, :inner_id]))
    create(unique_index(:cms_changelogs, [:original_community_raw, :inner_id]))
    create(unique_index(:cms_docs, [:original_community_raw, :inner_id]))
  end
end
