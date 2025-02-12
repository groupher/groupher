defmodule GroupherServer.Repo.Migrations.AddRssToDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:rss, :map)
    end
  end
end
