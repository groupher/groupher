defmodule GroupherServer.Repo.Migrations.EnforceTicketHistoryAndIdentity do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("DROP TRIGGER ticket_state_article_guard ON #{@cms}.ticket_states")
    execute("DROP TRIGGER ticket_binding_singleton_guard ON #{@cms}.article_bindings")
    execute("DROP TRIGGER ticket_article_requires_state ON #{@cms}.articles")

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_article_identity_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.thread = 'ticket' AND
         (TG_OP = 'DELETE' OR NEW.thread <> OLD.thread) THEN
        RAISE EXCEPTION 'ticket_article_identity_is_immutable' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_article_identity_guard
    BEFORE DELETE OR UPDATE OF thread ON #{@cms}.articles
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_article_identity_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_binding_singleton_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_thread text;
    BEGIN
      SELECT thread INTO ticket_thread FROM #{@cms}.articles WHERE id = NEW.article_id FOR UPDATE;
      IF TG_OP = 'UPDATE' AND
         EXISTS (SELECT 1 FROM #{@cms}.articles old_article WHERE old_article.id = OLD.article_id AND old_article.thread = 'ticket') AND
         (NEW.article_id <> OLD.article_id OR NEW.community_id <> OLD.community_id) THEN
        RAISE EXCEPTION 'ticket_article_binding_identity_is_immutable' USING ERRCODE = '23514';
      END IF;
      IF ticket_thread = 'ticket' AND EXISTS (
        SELECT 1 FROM #{@cms}.article_bindings b
        WHERE b.article_id = NEW.article_id AND b.id <> COALESCE(NEW.id, -1)
      ) THEN
        RAISE EXCEPTION 'ticket_article_binding_must_be_unique' USING ERRCODE = '23505';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_binding_singleton_guard
    BEFORE INSERT OR UPDATE OF article_id, community_id ON #{@cms}.article_bindings
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_binding_singleton_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_binding_delete_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles WHERE id = OLD.article_id AND thread = 'ticket') THEN
        RAISE EXCEPTION 'ticket_article_binding_is_immutable' USING ERRCODE = '23514';
      END IF;
      RETURN OLD;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_binding_delete_guard
    BEFORE DELETE ON #{@cms}.article_bindings
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_binding_delete_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_state_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_inner_id bigint;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM #{@cms}.articles a WHERE a.id = NEW.article_id AND a.thread = 'ticket') THEN
        RAISE EXCEPTION 'ticket_state_requires_ticket_article' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.type <> OLD.type THEN
        RAISE EXCEPTION 'ticket_type_is_immutable' USING ERRCODE = '23514';
      END IF;
      SELECT inner_id INTO ticket_inner_id
      FROM #{@cms}.article_bindings
      WHERE id = NEW.article_binding_id AND article_id = NEW.article_id;
      IF NEW.type = 'user' AND ticket_inner_id IS NULL THEN
        RAISE EXCEPTION 'user_ticket_requires_public_number' USING ERRCODE = '23514';
      END IF;
      IF NEW.type IN ('worker', 'case') AND ticket_inner_id IS NOT NULL THEN
        RAISE EXCEPTION 'internal_ticket_cannot_have_public_number' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_state_article_guard
    BEFORE INSERT OR UPDATE OF article_id, article_binding_id, type ON #{@cms}.ticket_states
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_state_article_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_article_requires_state()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE binding_count bigint; state_count bigint;
    BEGIN
      IF NEW.thread = 'ticket' THEN
        SELECT count(*) INTO binding_count FROM #{@cms}.article_bindings b WHERE b.article_id = NEW.id;
        SELECT count(*) INTO state_count FROM #{@cms}.ticket_states s WHERE s.article_id = NEW.id;
        IF binding_count <> 1 OR state_count <> 1 THEN
          RAISE EXCEPTION 'ticket_article_requires_one_binding_and_one_state' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE CONSTRAINT TRIGGER ticket_article_requires_state
    AFTER INSERT OR UPDATE OF thread ON #{@cms}.articles
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_article_requires_state()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_state_delete_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles WHERE id = OLD.article_id AND thread = 'ticket') THEN
        RAISE EXCEPTION 'ticket_state_is_required' USING ERRCODE = '23514';
      END IF;
      RETURN OLD;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_state_delete_guard
    BEFORE DELETE ON #{@cms}.ticket_states
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_state_delete_guard()
    """)

    execute("""
    ALTER TABLE #{@cms}.ticket_updates
      ADD CONSTRAINT ticket_updates_ticket_event_fkey
      FOREIGN KEY (ticket_id, event_id)
      REFERENCES #{@cms}.ticket_events (ticket_id, id) ON DELETE CASCADE
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.reject_ticket_history_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'ticket_history_is_append_only' USING ERRCODE = '23514';
    END;
    $$
    """)

    for table <- ~w(ticket_events ticket_updates) do
      execute("""
      CREATE TRIGGER #{table}_append_only
      BEFORE UPDATE OR DELETE ON #{@cms}.#{table}
      FOR EACH ROW EXECUTE FUNCTION #{@cms}.reject_ticket_history_mutation()
      """)
    end

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_case_member_worker_cleanup()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM #{@cms}.ticket_case_workers cw
      USING #{@cms}.ticket_workers w
      WHERE cw.case_ticket_id = OLD.case_ticket_id
        AND cw.worker_ticket_id = w.worker_ticket_id
        AND w.parent_ticket_id = OLD.user_ticket_id;
      RETURN OLD;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_case_member_worker_cleanup
    AFTER DELETE ON #{@cms}.ticket_case_members
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_case_member_worker_cleanup()
    """)
  end

  def down do
    execute(
      "DROP TRIGGER IF EXISTS ticket_case_member_worker_cleanup ON #{@cms}.ticket_case_members"
    )

    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_case_member_worker_cleanup()")

    for table <- ~w(ticket_events ticket_updates) do
      execute("DROP TRIGGER IF EXISTS #{table}_append_only ON #{@cms}.#{table}")
    end

    execute("DROP FUNCTION IF EXISTS #{@cms}.reject_ticket_history_mutation()")

    execute(
      "ALTER TABLE #{@cms}.ticket_updates DROP CONSTRAINT IF EXISTS ticket_updates_ticket_event_fkey"
    )

    execute("DROP TRIGGER IF EXISTS ticket_article_requires_state ON #{@cms}.articles")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_article_requires_state()")
    execute("DROP TRIGGER IF EXISTS ticket_state_delete_guard ON #{@cms}.ticket_states")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_state_delete_guard()")
    execute("DROP TRIGGER IF EXISTS ticket_state_article_guard ON #{@cms}.ticket_states")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_state_article_guard()")
    execute("DROP TRIGGER IF EXISTS ticket_binding_delete_guard ON #{@cms}.article_bindings")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_binding_delete_guard()")
    execute("DROP TRIGGER IF EXISTS ticket_binding_singleton_guard ON #{@cms}.article_bindings")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_binding_singleton_guard()")
    execute("DROP TRIGGER IF EXISTS ticket_article_identity_guard ON #{@cms}.articles")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_article_identity_guard()")
  end
end
