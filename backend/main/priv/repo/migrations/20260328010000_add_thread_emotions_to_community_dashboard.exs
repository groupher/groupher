defmodule GroupherServer.Repo.Migrations.AddThreadEmotionsToCommunityDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards, prefix: "cms") do
      add(:thread_emotions, :map)
    end
  end
end
