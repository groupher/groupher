defmodule GroupherServer.Repo.Migrations.UnifyCmsOutboxOperationIdentity do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.outbox_events) THEN
        RAISE EXCEPTION 'cms_outbox_identity_migration_requires_empty_outbox'
          USING ERRCODE = '23514';
      END IF;
    END;
    $$
    """)

    execute("DROP INDEX IF EXISTS cms.outbox_events_command_event_resource_index")

    alter table(:outbox_events, prefix: "cms") do
      remove(:command_id)
      remove(:identity_type)
      remove(:effect_key)
      add(:operation_ref, :uuid, null: false)
      add(:dedupe_key, :text, null: false)
      add(:failure_generation, :integer, null: false, default: 0)
    end

    create(
      unique_index(
        :outbox_events,
        [:event, :resource_type, :resource_id, :dedupe_key],
        prefix: "cms",
        name: :outbox_events_event_resource_dedupe_index
      )
    )

    create(
      constraint(:outbox_events, :outbox_events_failure_generation_check,
        prefix: "cms",
        check: "failure_generation >= 0"
      )
    )

    create(
      constraint(:outbox_events, :outbox_events_dedupe_key_non_blank_check,
        prefix: "cms",
        check: "length(btrim(dedupe_key)) > 0"
      )
    )
  end

  def down do
    raise "CMS Outbox operation identity is a one-way contract change"
  end
end
