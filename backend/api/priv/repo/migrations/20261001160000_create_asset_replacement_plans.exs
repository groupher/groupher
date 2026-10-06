defmodule GroupherServer.Repo.Migrations.CreateAssetReplacementPlans do
  use Ecto.Migration

  @moduledoc "Creates immutable, reviewable global asset replacement plans."

  def change do
    create table(:asset_replacement_plans, prefix: "cms") do
      add(:community_id, references(:communities, on_delete: :restrict), null: false)
      add(:from_asset_id, references(:community_assets, on_delete: :restrict), null: false)
      add(:to_asset_id, references(:community_assets, on_delete: :restrict), null: false)

      add(:created_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:status, :string, null: false, default: "pending")
      add(:items, :map, null: false)
      add(:applied_at, :timestamptz)
      timestamps()
    end

    create(index(:asset_replacement_plans, [:community_id, :status], prefix: "cms"))
    create(index(:asset_replacement_plans, [:from_asset_id], prefix: "cms"))
  end
end
