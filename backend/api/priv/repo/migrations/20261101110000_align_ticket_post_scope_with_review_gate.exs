defmodule GroupherServer.Repo.Migrations.AlignTicketPostScopeWithReviewGate do
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

  def down, do: :ok
end
