defmodule GroupherServer.Repo.Migrations.RemoveOldBlogThread do
  use Ecto.Migration

  def change do
    alter table(:abuse_reports) do
      remove(:blog_id)
    end

    alter table(:article_collects) do
      remove(:blog_id)
    end

    alter table(:article_upvotes) do
      remove(:blog_id)
    end

    alter table(:comments) do
      remove(:blog_id)
    end

    alter table(:articles_pinned_comments) do
      remove(:blog_id)
    end

    alter table(:pinned_comments) do
      remove(:blog_id)
    end

    alter table(:cited_artiments) do
      remove(:blog_id)
    end

    alter table(:articles_users_emotions) do
      remove(:blog_id)
    end

    alter table(:pinned_articles) do
      remove(:blog_id)
    end

    alter table(:communities_join_blogs) do
      remove(:blog_id)
    end

    alter table(:articles_join_tags) do
      remove(:blog_id)
    end

    drop_if_exists (unique_index(:communities_join_blogs, [:community_id, :blog_id] ))
    drop_if_exists (unique_index(:article_upvotes, [:user_id, :blog_id]))

    drop_if_exists table(:blog_documents)
    drop_if_exists table(:cms_blogs)
  end
end
