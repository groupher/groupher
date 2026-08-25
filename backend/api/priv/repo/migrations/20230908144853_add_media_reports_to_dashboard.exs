defmodule GroupherServer.Repo.Migrations.AddMediaReportsToDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:media_reports, {:array, :map})
    end
  end
end
