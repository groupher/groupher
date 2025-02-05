defmodule GroupherServer.Repo.Migrations.DropRepoModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:repo_id)
    end

    alter table(:article_collects) do
      remove(:repo_id)
    end

    alter table(:articles_users_emotions) do
      remove(:repo_id)
    end

    alter table(:pinned_comments) do
      remove(:repo_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:repo_id, :integer)
    end

    alter table(:comments) do
      remove(:repo_id)
    end

    alter table(:pinned_articles) do
      remove(:repo_id)
    end

    alter table(:articles_join_tags) do
      remove(:repo_id)
    end

    alter table(:cited_artiments) do
      remove(:repo_id)
    end

    alter table(:communities_join_repos) do
      remove(:repo_id)
    end


    alter table(:abuse_reports) do
      remove(:repo_id)
    end

    drop_if_exists table("repos_builders")

    drop_if_exists table("repos_tags")
    drop_if_exists table("repo_documents")
    drop_if_exists table("cms_repos")

    drop_if_exists table("community_wikis")
    drop_if_exists table("community_cheatsheets")
  end
end
