defmodule GroupherServer.Repo.Migrations.CreateChangelogJoinCommunity do
  use Ecto.Migration

  def change do
    create table(:communities_join_changelogs) do
      add(:community_id, references(:communities, on_delete: :delete_all), null: false)
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all), null: false)
    end

    create(unique_index(:communities_join_changelogs, [:community_id, :changelog_id]))
  end
end
