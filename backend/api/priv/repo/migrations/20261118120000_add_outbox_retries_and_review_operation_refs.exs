defmodule GroupherServer.Repo.Migrations.AddOutboxRetriesAndReviewOperationRefs do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.artiment_reviews) THEN
        RAISE EXCEPTION 'artiment_review_operation_ref_migration_requires_empty_reviews'
          USING ERRCODE = '23514';
      END IF;
    END;
    $$
    """)

    alter table(:artiment_reviews, prefix: "cms") do
      add(:operation_ref, :uuid, null: false)
    end

    execute("DROP INDEX IF EXISTS cms.community_assets_community_storage_key_index")

    create(
      unique_index(:community_assets, [:storage, :storage_key],
        prefix: "cms",
        name: :community_assets_storage_key_index,
        where: "storage IS NOT NULL AND storage_key IS NOT NULL"
      )
    )

    create(
      constraint(:community_assets, :community_assets_storage_identity_non_blank_check,
        prefix: "cms",
        check:
          "(storage IS NULL OR length(btrim(storage)) > 0) AND (storage_key IS NULL OR length(btrim(storage_key)) > 0)"
      )
    )

    create table(:outbox_retries, prefix: "cms") do
      add(
        :event_id,
        references(:outbox_events, prefix: "cms", type: :binary_id, on_delete: :restrict),
        null: false
      )

      add(:failure_generation, :integer, null: false)
      add(:initiator_kind, :text, null: false)
      add(:actor_id, :bigint)
      add(:reason, :text)
      add(:owner_ref, :text)
      add(:reason_code, :text)
      add(:failed_error_code, :text, null: false)
      add(:failed_error_at, :timestamptz, null: false)
      add(:original_operation_ref, :uuid, null: false)
      add(:retry_operation_ref, :uuid, null: false)
      add(:occurred_at, :timestamptz, null: false)
      timestamps()
    end

    create(
      unique_index(:outbox_retries, [:event_id, :failure_generation],
        prefix: "cms",
        name: :outbox_retries_event_generation_index
      )
    )

    create(
      constraint(:outbox_retries, :outbox_retries_generation_check,
        prefix: "cms",
        check: "failure_generation > 0"
      )
    )

    create(
      constraint(:outbox_retries, :outbox_retries_initiator_check,
        prefix: "cms",
        check:
          "(initiator_kind = 'user' AND actor_id IS NOT NULL AND length(btrim(reason)) > 0 AND owner_ref IS NULL AND reason_code IS NULL) OR (initiator_kind = 'owner' AND actor_id IS NULL AND reason IS NULL AND length(btrim(owner_ref)) > 0 AND length(btrim(reason_code)) > 0)"
      )
    )
  end

  def down do
    raise "Outbox retry credentials and review operation refs are one-way contract changes"
  end
end
