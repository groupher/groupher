defmodule GroupherServer.Repo.Migrations.AddFaqsForDashboard do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards) do
      add(:faqs, {:array, :map})
    end
  end
end
