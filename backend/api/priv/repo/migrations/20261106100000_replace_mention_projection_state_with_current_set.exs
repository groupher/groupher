defmodule GroupherServer.Repo.Migrations.ReplaceMentionProjectionStateWithCurrentSet do
  @moduledoc "Keeps one selected Mention set after the projector queue has drained."

  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM cms.mention_sync_states
        WHERE desired_set_id IS DISTINCT FROM synced_set_id
           OR desired_content_token IS DISTINCT FROM synced_content_token
      ) THEN
        RAISE EXCEPTION 'mention projection queue must be drained before current-set migration';
      END IF;
      IF EXISTS (
        SELECT 1 FROM cms.outbox_events
        WHERE event = 'mention.set_project' AND status <> 'completed'
      ) THEN
        RAISE EXCEPTION 'mention projection outbox events require review before current-set migration';
      END IF;
    END
    $$
    """)

    execute("DROP INDEX IF EXISTS cms.mention_sync_pending_index")
    execute("ALTER TABLE cms.mention_sync_states DROP CONSTRAINT mention_sync_synced_set_fk")
    execute("ALTER TABLE cms.mention_sync_states RENAME TO mention_current_sets")
    execute("ALTER TABLE cms.mention_current_sets RENAME CONSTRAINT mention_sync_states_pkey TO mention_current_sets_pkey")
    execute(
      "ALTER TABLE cms.mention_current_sets RENAME CONSTRAINT mention_sync_states_source_endpoint_id_fkey TO mention_current_sets_source_endpoint_id_fkey"
    )
    execute("ALTER TABLE cms.mention_current_sets RENAME COLUMN desired_set_id TO set_id")

    execute(
      "ALTER TABLE cms.mention_current_sets RENAME COLUMN desired_content_token TO content_token"
    )

    execute("ALTER TABLE cms.mention_current_sets DROP COLUMN synced_set_id")
    execute("ALTER TABLE cms.mention_current_sets DROP COLUMN synced_content_token")
    execute("ALTER TABLE cms.mention_current_sets DROP COLUMN synced_at")

    execute(
      "ALTER TABLE cms.mention_current_sets RENAME CONSTRAINT mention_sync_desired_set_fk TO mention_current_set_fk"
    )
  end

  def down do
    execute(
      "ALTER TABLE cms.mention_current_sets RENAME CONSTRAINT mention_current_set_fk TO mention_sync_desired_set_fk"
    )

    execute("ALTER TABLE cms.mention_current_sets ADD COLUMN synced_at timestamptz")
    execute("ALTER TABLE cms.mention_current_sets ADD COLUMN synced_content_token text")
    execute("ALTER TABLE cms.mention_current_sets ADD COLUMN synced_set_id uuid")

    execute(
      "UPDATE cms.mention_current_sets SET synced_set_id = set_id, synced_content_token = content_token, synced_at = updated_at"
    )

    execute(
      "ALTER TABLE cms.mention_current_sets RENAME COLUMN content_token TO desired_content_token"
    )

    execute("ALTER TABLE cms.mention_current_sets RENAME COLUMN set_id TO desired_set_id")
    execute(
      "ALTER TABLE cms.mention_current_sets RENAME CONSTRAINT mention_current_sets_source_endpoint_id_fkey TO mention_sync_states_source_endpoint_id_fkey"
    )
    execute("ALTER TABLE cms.mention_current_sets RENAME TO mention_sync_states")
    execute("ALTER TABLE cms.mention_sync_states RENAME CONSTRAINT mention_current_sets_pkey TO mention_sync_states_pkey")

    execute("""
    ALTER TABLE cms.mention_sync_states
    ADD CONSTRAINT mention_sync_synced_set_fk
    FOREIGN KEY (synced_set_id, source_endpoint_id)
    REFERENCES cms.mention_sets (id, source_endpoint_id) ON DELETE RESTRICT
    """)

    execute("""
    CREATE INDEX mention_sync_pending_index ON cms.mention_sync_states (source_endpoint_id)
    WHERE desired_set_id IS DISTINCT FROM synced_set_id
       OR desired_content_token IS DISTINCT FROM synced_content_token
    """)
  end
end
