defmodule GroupherServer.Repo.Migrations.EnforceTicketHistoryChecks do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    ALTER TABLE #{@cms}.ticket_events
      DROP CONSTRAINT IF EXISTS ticket_events_payload_check,
      DROP CONSTRAINT IF EXISTS ticket_events_source_check,
      ADD CONSTRAINT ticket_events_payload_check CHECK (
        (event_type = 'work_status'
          AND to_status IS NOT NULL
          AND from_visibility IS NULL
          AND to_visibility IS NULL)
        OR
        (event_type = 'visibility'
          AND from_status IS NULL
          AND to_status IS NULL
          AND from_visibility IS NOT NULL
          AND to_visibility IS NOT NULL
          AND reason IS NOT NULL
          AND length(trim(reason)) > 0)
      ),
      ADD CONSTRAINT ticket_events_source_check CHECK (
        actor_id IS NOT NULL
        OR (
          source_kind IS NOT NULL
          AND length(trim(source_kind)) > 0
          AND source_id IS NOT NULL
          AND length(trim(source_id)) > 0
        )
      )
    """)

    execute("""
    ALTER TABLE #{@cms}.ticket_updates
      DROP CONSTRAINT IF EXISTS ticket_updates_visibility_published_at_check,
      ADD CONSTRAINT ticket_updates_visibility_published_at_check CHECK (
        (visibility = 'public' AND published_at IS NOT NULL)
        OR
        (visibility = 'internal' AND published_at IS NULL)
      )
    """)
  end

  def down do
    execute("""
    ALTER TABLE #{@cms}.ticket_events
      DROP CONSTRAINT IF EXISTS ticket_events_payload_check,
      DROP CONSTRAINT IF EXISTS ticket_events_source_check,
      ADD CONSTRAINT ticket_events_payload_check CHECK (
        (event_type = 'work_status'
          AND to_status IS NOT NULL
          AND from_visibility IS NULL
          AND to_visibility IS NULL)
        OR
        (event_type = 'visibility'
          AND from_status IS NULL
          AND to_status IS NULL
          AND from_visibility IS NOT NULL
          AND to_visibility IS NOT NULL
          AND reason IS NOT NULL
          AND length(trim(reason)) > 0)
      ),
      ADD CONSTRAINT ticket_events_source_check CHECK (
        actor_id IS NOT NULL
        OR (length(trim(source_kind)) > 0 AND length(trim(source_id)) > 0)
      )
    """)

    execute("""
    ALTER TABLE #{@cms}.ticket_updates
      DROP CONSTRAINT IF EXISTS ticket_updates_visibility_published_at_check,
      ADD CONSTRAINT ticket_updates_visibility_published_at_check CHECK (
        (visibility = 'public' AND published_at IS NOT NULL)
        OR
        (visibility = 'internal' AND published_at IS NULL)
      )
    """)
  end
end
