defmodule GroupherServer.Repo.Migrations.TicketV2AuthorityCutover do
  use Ecto.Migration

  @cms "cms"

  def up do
    # Replace guards before dropping the V1 TicketState columns they used.
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.articles a
        WHERE a.id = NEW.article_id AND a.thread = 'ticket'
      ) AND NOT EXISTS (
        SELECT 1
        FROM #{@cms}.ticket_states s
        JOIN #{@cms}.article_bindings b
          ON b.id = s.article_binding_id AND b.article_id = s.article_id
        JOIN #{@cms}.article_lifecycles l
          ON l.article_id = s.article_id AND l.thread = 'ticket'
        JOIN #{@cms}.article_revisions r
          ON r.id = NEW.revision_id AND r.article_id = s.article_id
        WHERE s.article_id = NEW.article_id
          AND s.type = 'user'
          AND l.state = 'published'
          AND b.inner_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'article_public_requires_published_user_ticket_revision'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_update_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.visibility = 'public' AND NOT EXISTS (
        SELECT 1
        FROM #{@cms}.ticket_states s
        JOIN #{@cms}.article_lifecycles l
          ON l.article_id = s.article_id AND l.thread = 'ticket' AND l.state = 'published'
        JOIN #{@cms}.article_bindings b
          ON b.id = s.article_binding_id AND b.article_id = s.article_id
        JOIN #{@cms}.communities c ON c.id = b.community_id
        LEFT JOIN #{@cms}.community_lifecycles cl ON cl.community_id = c.id
        WHERE s.article_id = NEW.ticket_id
          AND s.type = 'user'
          AND (
            (cl.id IS NOT NULL AND cl.state IN ('active', 'read_only')) OR
            (cl.id IS NULL AND c.pending = 0)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM #{@cms}.article_review_blocks rb
            WHERE rb.article_id = s.article_id AND rb.resolved_at IS NULL
          )
      ) THEN
        RAISE EXCEPTION 'public_ticket_update_requires_visible_unblocked_published_user_ticket'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute(
      "ALTER TABLE #{@cms}.ticket_states DROP CONSTRAINT IF EXISTS ticket_states_current_revision_fkey"
    )

    execute(
      "ALTER TABLE #{@cms}.ticket_states DROP CONSTRAINT IF EXISTS ticket_states_type_visibility_check"
    )

    execute(
      "ALTER TABLE #{@cms}.ticket_states DROP CONSTRAINT IF EXISTS ticket_states_version_check"
    )

    execute(
      "ALTER TABLE #{@cms}.ticket_updates DROP CONSTRAINT IF EXISTS ticket_updates_ticket_event_fkey"
    )

    execute(
      "ALTER TABLE #{@cms}.ticket_updates DROP CONSTRAINT IF EXISTS ticket_updates_event_id_fkey"
    )

    execute("DROP INDEX IF EXISTS #{@cms}.ticket_updates_event_index")

    alter table(:ticket_updates, prefix: @cms) do
      remove(:event_id)
    end

    execute("DROP TRIGGER IF EXISTS ticket_events_append_only ON #{@cms}.ticket_events")
    execute("DROP TRIGGER IF EXISTS ticket_event_guard ON #{@cms}.ticket_events")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_event_guard()")
    drop_if_exists(table(:ticket_events, prefix: @cms))

    execute("DROP TRIGGER IF EXISTS ticket_asset_revision_guard ON #{@cms}.ticket_asset_refs")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_asset_revision_guard()")
    drop_if_exists(table(:ticket_asset_refs, prefix: @cms))

    execute("ALTER TABLE #{@cms}.ticket_states RENAME COLUMN version TO workflow_version")

    alter table(:ticket_states, prefix: @cms) do
      remove(:current_revision_id)
      remove(:public_visibility)
    end

    execute("""
    ALTER TABLE #{@cms}.ticket_states
      ADD CONSTRAINT ticket_states_workflow_version_check CHECK (workflow_version > 0)
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_article_requires_state()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE binding_count bigint; state_count bigint; lifecycle_count bigint;
    BEGIN
      IF NEW.thread = 'ticket' THEN
        SELECT count(*) INTO binding_count
        FROM #{@cms}.article_bindings b WHERE b.article_id = NEW.id;
        SELECT count(*) INTO state_count
        FROM #{@cms}.ticket_states s WHERE s.article_id = NEW.id;
        SELECT count(*) INTO lifecycle_count
        FROM #{@cms}.article_lifecycles l
        WHERE l.article_id = NEW.id AND l.thread = 'ticket';

        IF binding_count <> 1 OR state_count <> 1 OR lifecycle_count <> 1 THEN
          RAISE EXCEPTION 'ticket_article_requires_one_binding_state_and_lifecycle'
            USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_lifecycle_final_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_article_id uuid; ticket_type text; ticket_state text;
      ticket_thread text; ticket_number bigint; public_count bigint;
      first_publication timestamptz;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        target_article_id := OLD.article_id;
      ELSE
        target_article_id := NEW.article_id;
      END IF;

      SELECT s.type, l.state, l.thread, b.inner_id, l.first_published_at
      INTO ticket_type, ticket_state, ticket_thread, ticket_number, first_publication
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_lifecycles l ON l.article_id = s.article_id
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = target_article_id;

      IF NOT FOUND THEN
        IF EXISTS (
          SELECT 1 FROM #{@cms}.articles a
          WHERE a.id = target_article_id AND a.thread = 'ticket'
        ) THEN
          RAISE EXCEPTION 'ticket_requires_state_binding_and_lifecycle'
            USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END IF;

      SELECT count(*) INTO public_count
      FROM #{@cms}.article_publics ap WHERE ap.article_id = target_article_id;

      IF ticket_thread <> 'ticket' OR ticket_state NOT IN ('draft', 'published') THEN
        RAISE EXCEPTION 'ticket_lifecycle_state_not_supported' USING ERRCODE = '23514';
      END IF;

      IF ticket_type = 'user' THEN
        IF ticket_state = 'published' AND (ticket_number IS NULL OR public_count <> 1) THEN
          RAISE EXCEPTION 'published_user_ticket_requires_number_and_public_revision'
            USING ERRCODE = '23514';
        END IF;

        IF first_publication IS NOT NULL AND ticket_number IS NULL THEN
          RAISE EXCEPTION 'previously_published_user_ticket_requires_number'
            USING ERRCODE = '23514';
        END IF;
      ELSIF ticket_state <> 'draft' OR ticket_number IS NOT NULL OR public_count <> 0 THEN
        RAISE EXCEPTION 'internal_ticket_must_remain_draft_without_public_identity'
          USING ERRCODE = '23514';
      END IF;

      RETURN NULL;
    END;
    $$
    """)

    for table <- ~w(article_lifecycles ticket_states article_publics) do
      execute("""
      DROP TRIGGER IF EXISTS ticket_lifecycle_final_guard ON #{@cms}.#{table}
      """)

      execute("""
      CREATE CONSTRAINT TRIGGER ticket_lifecycle_final_guard
      AFTER INSERT OR UPDATE OR DELETE ON #{@cms}.#{table}
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_lifecycle_final_guard()
      """)
    end
  end

  def down do
    raise "Ticket V2 authority cutover is irreversible; restore the pre-cutover snapshot instead"
  end
end
