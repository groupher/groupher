defmodule GroupherServer.Repo.Migrations.AddLinksToDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:header_links, {:array, :map})
      add(:footer_links, {:array, :map})
    end
  end
end
