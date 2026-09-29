defmodule GroupherServer.Repo.Migrations.CreatePublicCacheInvalidations do
  use Ecto.Migration

  def change do
    create table(:public_cache_invalidations, prefix: "cms", primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:contract_version, :smallint, null: false, default: 1)
      add(:type, :string, null: false)
      add(:aggregate_type, :string, null: false)
      add(:aggregate_id, :string, null: false)
      add(:community_id, :bigint)
      add(:payload, :map, null: false, default: %{})
      add(:causation_id, :uuid)
      add(:status, :string, null: false, default: "pending")
      add(:attempts, :integer, null: false, default: 0)
      add(:available_at, :timestamptz, null: false)
      add(:locked_at, :timestamptz)
      add(:locked_by, :string)
      add(:delivered_at, :timestamptz)
      add(:last_error_code, :string)
      add(:last_error_at, :timestamptz)

      timestamps()
    end

    create(index(:public_cache_invalidations, [:status, :available_at], prefix: "cms"))

    create(
      unique_index(
        :public_cache_invalidations,
        [:causation_id, :type, :aggregate_type, :aggregate_id],
        prefix: "cms",
        name: :public_cache_invalidations_causation_type_aggregate_index,
        where: "causation_id IS NOT NULL"
      )
    )
  end
end
