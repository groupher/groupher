defmodule GroupherServer.Repo.Migrations.AddChangelogRefIds do
  use Ecto.Migration

  def change do
    alter table(:articles_join_tags) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:abuse_reports) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:article_collects) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:article_upvotes) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:comments) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:pinned_comments) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:articles_users_emotions) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:pinned_articles) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end

    alter table(:cited_artiments) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all))
    end
  end
end
