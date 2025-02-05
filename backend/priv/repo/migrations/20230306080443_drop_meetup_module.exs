defmodule GroupherServer.Repo.Migrations.DropMeetupModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:meetup_id)
    end

    alter table(:article_collects) do
      remove(:meetup_id)
    end

    alter table(:articles_users_emotions) do
      remove(:meetup_id)
    end

    alter table(:pinned_comments) do
      remove(:meetup_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:meetup_id, :integer)
    end

    alter table(:comments) do
      remove(:meetup_id)
    end

    alter table(:pinned_articles) do
      remove(:meetup_id)
    end

    alter table(:articles_join_tags) do
      remove(:meetup_id)
    end

    alter table(:cited_artiments) do
      remove(:meetup_id)
    end

    alter table(:communities_join_meetups) do
      remove(:meetup_id)
    end


    alter table(:abuse_reports) do
      remove(:meetup_id)
    end

    drop_if_exists table("meetups_tags")
    drop_if_exists table("meetup_documents")
    drop_if_exists table("cms_meetups")
  end
end
