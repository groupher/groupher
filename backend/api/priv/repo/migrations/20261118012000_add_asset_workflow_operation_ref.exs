defmodule GroupherServer.Repo.Migrations.AddAssetWorkflowOperationRef do
  use Ecto.Migration

  def change do
    alter table(:asset_workflow_steps, prefix: "cms") do
      add(:operation_ref, :uuid, null: false, default: fragment("gen_random_uuid()"))
    end

    create(unique_index(:asset_workflow_steps, [:operation_ref], prefix: "cms"))
  end
end
