defmodule GroupherServer.Repo.Migrations.GuardTicketPostArticleBindings do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_post_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_community_id bigint; linked_post_is_public boolean;
    BEGIN
      SELECT b.community_id INTO ticket_community_id
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      JOIN #{@cms}.articles t ON t.id = s.article_id AND t.thread = 'ticket'
      WHERE s.article_id = NEW.ticket_id AND s.type = 'user'
        AND s.public_visibility = 'published'
      FOR UPDATE OF s;
      IF ticket_community_id IS NULL THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;

      PERFORM b.id
      FROM #{@cms}.article_bindings b
      WHERE b.article_id = NEW.post_id AND b.community_id = ticket_community_id
      FOR UPDATE OF b;

      SELECT EXISTS (
        SELECT 1
        FROM #{@cms}.articles p
        JOIN #{@cms}.article_bindings b
          ON b.article_id = p.id AND b.community_id = ticket_community_id
        JOIN #{@cms}.communities c ON c.id = b.community_id
        JOIN #{@cms}.article_lifecycles al
          ON al.article_id = p.id AND al.state IN ('published', 'archived')
        LEFT JOIN #{@cms}.community_lifecycles cl ON cl.community_id = c.id
        WHERE p.id = NEW.post_id AND p.thread = 'post'
          AND ((cl.id IS NOT NULL AND cl.state IN ('active', 'read_only'))
            OR (cl.id IS NULL AND c.pending = 0))
          AND EXISTS (
            SELECT 1 FROM #{@cms}.article_publics ap
            WHERE ap.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.trashed_articles ta
            WHERE ta.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.article_review_blocks rb
            WHERE rb.article_id = p.id AND rb.resolved_at IS NULL
              AND (rb.community_id IS NULL OR rb.community_id = ticket_community_id)
          )
      ) INTO linked_post_is_public;

      IF NOT linked_post_is_public THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.article_binding_ticket_post_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.articles a WHERE a.id = OLD.article_id
      ) AND EXISTS (
        SELECT 1
        FROM #{@cms}.ticket_posts tp
        JOIN #{@cms}.ticket_states ts
          ON ts.article_id = tp.ticket_id AND ts.type = 'user'
        JOIN #{@cms}.article_bindings ticket_binding
          ON ticket_binding.id = ts.article_binding_id
        WHERE tp.post_id = OLD.article_id
          AND ticket_binding.community_id = OLD.community_id
      ) THEN
        RAISE EXCEPTION 'article_binding_has_linked_ticket_post'
          USING ERRCODE = '23514', CONSTRAINT = 'article_binding_ticket_post_guard';
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER article_binding_ticket_post_guard
    BEFORE DELETE OR UPDATE OF article_id, community_id ON #{@cms}.article_bindings
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.article_binding_ticket_post_guard()
    """)

    execute("""
    CREATE UNIQUE INDEX ticket_updates_supersedes_unique
    ON #{@cms}.ticket_updates (supersedes_id)
    WHERE supersedes_id IS NOT NULL
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_update_supersedes_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE original_ticket_id uuid; original_visibility text;
    BEGIN
      IF NEW.supersedes_id IS NULL THEN
        RETURN NEW;
      END IF;

      IF NEW.visibility <> 'public' THEN
        RAISE EXCEPTION 'ticket_update_supersedes_requires_public_update'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_update_supersedes_guard';
      END IF;

      IF NEW.id = NEW.supersedes_id THEN
        RAISE EXCEPTION 'ticket_update_cannot_supersede_itself'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_update_supersedes_guard';
      END IF;

      SELECT ticket_id, visibility INTO original_ticket_id, original_visibility
      FROM #{@cms}.ticket_updates
      WHERE id = NEW.supersedes_id
      FOR UPDATE;

      IF original_ticket_id IS DISTINCT FROM NEW.ticket_id OR original_visibility <> 'public' THEN
        RAISE EXCEPTION 'ticket_update_supersedes_requires_same_ticket_public_update'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_update_supersedes_guard';
      END IF;

      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_update_supersedes_guard
    BEFORE INSERT OR UPDATE OF ticket_id, visibility, supersedes_id ON #{@cms}.ticket_updates
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_update_supersedes_guard()
    """)
  end

  def down do
    execute("DROP TRIGGER IF EXISTS ticket_update_supersedes_guard ON #{@cms}.ticket_updates")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_update_supersedes_guard()")
    execute("DROP INDEX IF EXISTS #{@cms}.ticket_updates_supersedes_unique")

    execute(
      "DROP TRIGGER IF EXISTS article_binding_ticket_post_guard ON #{@cms}.article_bindings"
    )

    execute("DROP FUNCTION IF EXISTS #{@cms}.article_binding_ticket_post_guard()")

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_post_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_community_id bigint; linked_post_is_public boolean;
    BEGIN
      SELECT b.community_id INTO ticket_community_id
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      JOIN #{@cms}.articles t ON t.id = s.article_id AND t.thread = 'ticket'
      WHERE s.article_id = NEW.ticket_id AND s.type = 'user'
        AND s.public_visibility = 'published'
      FOR UPDATE OF s;
      IF ticket_community_id IS NULL THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM #{@cms}.articles p
        JOIN #{@cms}.article_bindings b
          ON b.article_id = p.id AND b.community_id = ticket_community_id
        JOIN #{@cms}.communities c ON c.id = b.community_id
        JOIN #{@cms}.article_lifecycles al
          ON al.article_id = p.id AND al.state IN ('published', 'archived')
        LEFT JOIN #{@cms}.community_lifecycles cl ON cl.community_id = c.id
        WHERE p.id = NEW.post_id AND p.thread = 'post'
          AND ((cl.id IS NOT NULL AND cl.state IN ('active', 'read_only'))
            OR (cl.id IS NULL AND c.pending = 0))
          AND EXISTS (
            SELECT 1 FROM #{@cms}.article_publics ap
            WHERE ap.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.trashed_articles ta
            WHERE ta.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.article_review_blocks rb
            WHERE rb.article_id = p.id AND rb.resolved_at IS NULL
              AND (rb.community_id IS NULL OR rb.community_id = ticket_community_id)
          )
      ) INTO linked_post_is_public;

      IF NOT linked_post_is_public THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)
  end
end
