defmodule GroupherServer.Repo.Migrations.AddThirdPartyAnalyticsToCommunityDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards, prefix: "cms") do
      add(:third_party_analytics, :map)
    end
  end
end
