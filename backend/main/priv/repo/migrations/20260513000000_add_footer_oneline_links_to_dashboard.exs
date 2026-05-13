defmodule GroupherServer.Repo.Migrations.AddFooterOnelineLinksToDashboard do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:community_dashboards, prefix: @prefix) do
      add(:footer_oneline_links, {:array, :map}, default: [], null: false)
    end
  end
end
