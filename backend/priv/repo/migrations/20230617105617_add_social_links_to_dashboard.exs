defmodule GroupherServer.Repo.Migrations.AddSocialLinksToDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:social_links, {:array, :map})
    end
  end
end
