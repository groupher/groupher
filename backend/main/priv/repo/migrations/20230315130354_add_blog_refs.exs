defmodule GroupherServer.Repo.Migrations.AddBlogRefs do
  use Ecto.Migration

  def change do
    alter table(:articles_join_tags) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:abuse_reports) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:article_collects) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:article_upvotes) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:comments) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:pinned_comments) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:articles_users_emotions) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:pinned_articles) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    alter table(:cited_artiments) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all))
    end

    create(unique_index(:article_upvotes, [:user_id, :blog_id]))
  end
end
