defmodule GroupherServer.Repo.Migrations.AddMissingArchivedAtChangelog do
  use Ecto.Migration

  def change do
    alter table(:cms_changelogs) do
      add(:archived_at, :utc_datetime)
    end
  end
end
