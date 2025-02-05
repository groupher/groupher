defmodule GroupherServer.Repo.Migrations.RmGlowefforctInDashboard do
  use Ecto.Migration

  def change do
    alter(table(:community_dashboards), do: remove(:glow_effect))
  end
end
