defmodule GroupherServer.Repo.Migrations.DropGuideModule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:guide_id)
    end

    alter table(:article_collects) do
      remove(:guide_id)
    end

    alter table(:articles_users_emotions) do
      remove(:guide_id)
    end

    alter table(:pinned_comments) do
      remove(:guide_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:guide_id, :integer)
    end

    alter table(:comments) do
      remove(:guide_id)
    end

    alter table(:pinned_articles) do
      remove(:guide_id)
    end

    alter table(:articles_join_tags) do
      remove(:guide_id)
    end

    alter table(:cited_artiments) do
      remove(:guide_id)
    end

    alter table(:communities_join_guides) do
      remove(:guide_id)
    end


    alter table(:abuse_reports) do
      remove(:guide_id)
    end

    drop_if_exists table("guides_tags")
    drop_if_exists table("guide_documents")
    drop_if_exists table("cms_guides")
  end
end
