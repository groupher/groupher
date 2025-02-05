defmodule GroupherServer.Repo.Migrations.DropDrinkModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:drink_id)
    end

    alter table(:article_collects) do
      remove(:drink_id)
    end

    alter table(:articles_users_emotions) do
      remove(:drink_id)
    end

    alter table(:pinned_comments) do
      remove(:drink_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:drink_id, :integer)
    end

    alter table(:comments) do
      remove(:drink_id)
    end

    alter table(:pinned_articles) do
      remove(:drink_id)
    end

    alter table(:articles_join_tags) do
      remove(:drink_id)
    end

    alter table(:cited_artiments) do
      remove(:drink_id)
    end

    alter table(:communities_join_drinks) do
      remove(:drink_id)
    end


    alter table(:abuse_reports) do
      remove(:drink_id)
    end

    drop_if_exists table("drinks_tags")
    drop_if_exists table("drink_documents")
    drop_if_exists table("cms_drinks")
  end
end
