defmodule GroupherServer.Repo.Migrations.DropRadarMoudule do
  use Ecto.Migration

  def change do
    alter table(:article_upvotes) do
      remove(:radar_id)
    end

    alter table(:article_collects) do
      remove(:radar_id)
    end

    alter table(:articles_users_emotions) do
      remove(:radar_id)
    end

    alter table(:pinned_comments) do
      remove(:radar_id)
    end

    alter table(:articles_pinned_comments) do
      remove_if_exists(:radar_id, :integer)
    end

    alter table(:comments) do
      remove(:radar_id)
    end

    alter table(:pinned_articles) do
      remove(:radar_id)
    end

    alter table(:articles_join_tags) do
      remove(:radar_id)
    end

    alter table(:cited_artiments) do
      remove(:radar_id)
    end

    alter table(:communities_join_radars) do
      remove(:radar_id)
    end


    alter table(:abuse_reports) do
      remove(:radar_id)
    end

    drop_if_exists table("radars_tags")
    drop_if_exists table("radar_documents")
    drop_if_exists table("cms_radars")
  end
end
