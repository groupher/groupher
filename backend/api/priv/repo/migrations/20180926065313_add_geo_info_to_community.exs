defmodule GroupherServer.Repo.Migrations.AddGeoInfoToCommunity do
  use Ecto.Migration

  def change do
    alter table(:communities) do
      add(:geo_info, :map, default: %{data: []})
    end
  end
end
