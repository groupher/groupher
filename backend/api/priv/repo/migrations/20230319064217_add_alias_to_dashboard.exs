defmodule GroupherServer.Repo.Migrations.AddAliasToDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:alias, {:array, :map})
    end
  end
end
