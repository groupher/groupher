defmodule GroupherServer.Repo.Migrations.ReplaceTicketPostsWithSources do
  use Ecto.Migration

  @cms "cms"

  def up do
    # This migration drops the V1 relation table. Keep the cutover preflight in
    # the same migration and before any DDL so an incomplete data reset cannot
    # leave the schema half-switched when a later migration rejects the data.
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles) OR
         EXISTS (SELECT 1 FROM #{@cms}.article_lifecycles) OR
         EXISTS (SELECT 1 FROM #{@cms}.doc_lifecycles) OR
         EXISTS (SELECT 1 FROM #{@cms}.trashed_articles) OR
         EXISTS (SELECT 1 FROM #{@cms}.trashed_doc_articles) OR
         EXISTS (SELECT 1 FROM #{@cms}.ticket_posts) OR
         EXISTS (SELECT 1 FROM #{@cms}.ticket_facets) THEN
        RAISE EXCEPTION 'ticket_v2_article_cutover_requires_content_reset';
      END IF;
    END;
    $$
    """)

    execute("DROP TRIGGER IF EXISTS ticket_post_scope_guard ON #{@cms}.ticket_posts")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_post_scope_guard()")

    execute(
      "DROP TRIGGER IF EXISTS article_binding_ticket_post_guard ON #{@cms}.article_bindings"
    )

    execute("DROP FUNCTION IF EXISTS #{@cms}.article_binding_ticket_post_guard()")

    execute("DROP TABLE #{@cms}.ticket_posts")

    execute("""
    CREATE TABLE #{@cms}.ticket_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id uuid NOT NULL REFERENCES #{@cms}.articles(id) ON DELETE RESTRICT,
      type text NOT NULL,
      post_id uuid NOT NULL REFERENCES #{@cms}.articles(id) ON DELETE RESTRICT,
      inserted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
      CONSTRAINT ticket_sources_type_check CHECK (type = 'post'),
      CONSTRAINT ticket_sources_ticket_post_check CHECK (ticket_id <> post_id)
    )
    """)

    execute("""
    CREATE UNIQUE INDEX ticket_sources_ticket_post_index
    ON #{@cms}.ticket_sources (ticket_id, post_id)
    """)

    execute("""
    CREATE INDEX ticket_sources_post_ticket_index
    ON #{@cms}.ticket_sources (post_id, ticket_id)
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_source_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_community_id bigint; linked_post_is_public boolean;
    BEGIN
      IF TG_OP = 'UPDATE' AND (
        NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR
        NEW.type IS DISTINCT FROM OLD.type OR
        NEW.post_id IS DISTINCT FROM OLD.post_id
      ) THEN
        RAISE EXCEPTION 'ticket_source_identity_is_immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_source_scope_guard';
      END IF;

      IF NEW.type <> 'post' THEN
        RAISE EXCEPTION 'ticket_source_type_not_supported'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_sources_type_check';
      END IF;

      SELECT b.community_id INTO ticket_community_id
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      JOIN #{@cms}.articles t ON t.id = s.article_id AND t.thread = 'ticket'
      WHERE s.article_id = NEW.ticket_id AND s.type = 'user'
      FOR UPDATE OF s;

      IF ticket_community_id IS NULL THEN
        RAISE EXCEPTION 'ticket_source_requires_user_ticket'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_source_requires_user_ticket';
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
        RAISE EXCEPTION 'ticket_source_requires_public_same_community_post'
          USING ERRCODE = '23514', CONSTRAINT = 'ticket_source_scope_guard';
      END IF;

      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_source_scope_guard
    BEFORE INSERT OR UPDATE OF ticket_id, type, post_id ON #{@cms}.ticket_sources
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_source_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.article_binding_ticket_source_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.articles a WHERE a.id = OLD.article_id
      ) AND EXISTS (
        SELECT 1 FROM #{@cms}.ticket_sources ts
        WHERE ts.post_id = OLD.article_id AND ts.type = 'post'
      ) THEN
        RAISE EXCEPTION 'article_binding_has_ticket_source'
          USING ERRCODE = '23514', CONSTRAINT = 'article_binding_ticket_source_guard';
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER article_binding_ticket_source_guard
    BEFORE DELETE OR UPDATE OF article_id, community_id ON #{@cms}.article_bindings
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.article_binding_ticket_source_guard()
    """)
  end

  def down do
    raise "TicketSource cutover is irreversible; restore the pre-cutover database snapshot"
  end
end
