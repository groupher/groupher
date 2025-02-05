defmodule GroupherServer.Repo.Migrations.DropWorksModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:works_id)
    end

    alter table(:article_collects) do
      remove(:works_id)
    end

    alter table(:articles_users_emotions) do
      remove(:works_id)
    end

    alter table(:pinned_comments) do
      remove(:works_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:works_id, :integer)
    end

    alter table(:comments) do
      remove(:works_id)
    end

    alter table(:pinned_articles) do
      remove(:works_id)
    end

    alter table(:articles_join_tags) do
      remove(:works_id)
    end

    alter table(:cited_artiments) do
      remove(:works_id)
    end

    alter table(:communities_join_works) do
      remove(:works_id)
    end


    alter table(:abuse_reports) do
      remove(:works_id)
    end

    drop_if_exists table("works_join_cities")
    drop_if_exists table("works_join_techstacks")
    drop_if_exists table("works_join_teammates")

    drop_if_exists table("cms_techstacks")
    drop_if_exists table("cms_cities")

    drop_if_exists table("works_tags")
    drop_if_exists table("works_documents")
    drop_if_exists table("cms_works")
  end
end
