defmodule GroupherServer.Repo.Migrations.AddCmsOutboxWorkerRoute do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.outbox_events) THEN
        RAISE EXCEPTION 'cms_outbox_worker_route_migration_requires_empty_outbox'
          USING ERRCODE = '23514';
      END IF;
    END;
    $$
    """)

    alter table(:outbox_events, prefix: "cms") do
      add(:worker, :text, null: false)
    end

    create(constraint(:outbox_events, :outbox_events_worker_non_blank_check,
             prefix: "cms",
             check: "length(btrim(worker)) > 0"
           ))

    create(index(:outbox_events, [:status, :locked_at],
             prefix: "cms",
             name: :outbox_events_status_locked_at_index
           ))
  end

  def down do
    drop(index(:outbox_events, [:status, :locked_at],
           prefix: "cms",
           name: :outbox_events_status_locked_at_index
         ))

    drop(constraint(:outbox_events, :outbox_events_worker_non_blank_check, prefix: "cms"))

    alter table(:outbox_events, prefix: "cms") do
      remove(:worker)
    end
  end
end
