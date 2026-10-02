defmodule GroupherServer.Repo.Migrations.AddAssetArchiveState do
  use Ecto.Migration

  def change do
    alter table(:community_assets, prefix: "cms") do
      add(:archived_at, :timestamptz)
    end

    create(index(:community_assets, [:community_id, :status, :inserted_at], prefix: "cms"))
  end
end
