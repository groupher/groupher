defmodule GroupherServer.Repo.Migrations.AddApplyRunRefToAssetReplacementPlans do
  use Ecto.Migration

  @moduledoc "Persists the stable apply identity for resumable asset replacement workflows."

  def change do
    alter table(:asset_replacement_plans, prefix: "cms") do
      add(:apply_run_ref, :string)
    end

    create(index(:asset_replacement_plans, [:apply_run_ref], prefix: "cms"))
  end
end
