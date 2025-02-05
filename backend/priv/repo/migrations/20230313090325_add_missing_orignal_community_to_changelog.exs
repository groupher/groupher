defmodule GroupherServer.Repo.Migrations.AddMissingOrignalCommunityToChangelog do
  use Ecto.Migration

  def change do
    alter table(:cms_changelogs) do
      add(:original_community_id, references(:communities, on_delete: :delete_all))
    end
  end
end
