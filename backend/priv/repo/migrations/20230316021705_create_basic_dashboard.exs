defmodule GroupherServer.Repo.Migrations.CreateBasicDashboard do
  use Ecto.Migration

  def change do
    create table(:community_dashboards) do
      add(:base_info, :map)
      add(:seo, :map)
      add(:layout, :map)
      add(:glow_effect, :map)
      add(:wallpaper, :map)
      add(:enable, :map)

      add(:community_id, references(:communities, on_delete: :delete_all), null: false)

      timestamps()
    end
  end
end
