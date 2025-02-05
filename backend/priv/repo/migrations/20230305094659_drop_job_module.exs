defmodule GroupherServer.Repo.Migrations.DropJobModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:job_id)
    end

    alter table(:article_collects) do
      remove(:job_id)
    end

    alter table(:articles_users_emotions) do
      remove(:job_id)
    end

    alter table(:pinned_comments) do
      remove(:job_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:job_id, :integer)
    end

    alter table(:comments) do
      remove(:job_id)
    end

    alter table(:pinned_articles) do
      remove(:job_id)
    end

    alter table(:articles_join_tags) do
      remove(:job_id)
    end

    alter table(:cited_artiments) do
      remove(:job_id)
    end

    alter table(:communities_join_jobs) do
      remove(:job_id)
    end


    alter table(:abuse_reports) do
      remove(:job_id)
    end

    # drop table("pined_jobs")
    # drop table("jobs_viewers")
    # drop table("jobs_communities_flags")
    # drop table("jobs_comments")
    drop_if_exists table("jobs_tags")
    # drop table("jobs_favorites")
    # drop table("jobs_stars")
    # drop table("communities_jobs")
    drop_if_exists table("job_documents")
    drop_if_exists table("cms_jobs")
  end
end
