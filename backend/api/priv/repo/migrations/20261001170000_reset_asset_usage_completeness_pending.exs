defmodule GroupherServer.Repo.Migrations.ResetAssetUsageCompletenessPending do
  use Ecto.Migration

  @moduledoc "Keeps the asset deletion fence closed until the usage receipt is rebuilt."

  def up do
    execute("""
    UPDATE cms.asset_usage_completeness
    SET status = 'pending',
        receipt_id = NULL,
        completed_at = NULL,
        updated_at = NOW()
    """)
  end

  def down do
    execute("SELECT 1")
  end
end
