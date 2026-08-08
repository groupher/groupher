defmodule GroupherServer.Repo.Migrations.AddUmamiWebsiteIdToCommunityDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards, prefix: "cms") do
      add(:umami_website_id, :uuid)
    end

    create(
      unique_index(:community_dashboards, [:umami_website_id],
        prefix: "cms",
        where: "umami_website_id IS NOT NULL"
      )
    )
  end
end
