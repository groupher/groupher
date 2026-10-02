defmodule GroupherServer.Repo.Migrations.CreateAssetUsageCompleteness do
  use Ecto.Migration

  def up do
    create table(:asset_usage_completeness, prefix: "cms", primary_key: false) do
      add(:community_id, references(:communities, prefix: "cms", on_delete: :delete_all),
        primary_key: true,
        null: false
      )

      add(:schema_version, :smallint, null: false, default: 1)
      add(:status, :string, null: false, default: "pending")
      add(:scope, :string, null: false, default: "community")
      add(:receipt_id, :uuid)
      add(:completed_at, :timestamptz)
      timestamps()
    end

    execute("""
    INSERT INTO cms.asset_usage_completeness (community_id, schema_version, status, scope, inserted_at, updated_at)
    SELECT id, 1, 'pending', 'community', NOW(), NOW()
    FROM cms.communities
    ON CONFLICT (community_id) DO NOTHING
    """)
  end

  def down do
    drop(table(:asset_usage_completeness, prefix: "cms"))
  end
end
