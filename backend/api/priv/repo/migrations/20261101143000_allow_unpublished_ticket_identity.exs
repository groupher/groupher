defmodule GroupherServer.Repo.Migrations.AllowUnpublishedTicketIdentity do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_state_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_inner_id integer; ticket_lifecycle_state text; first_published_at timestamptz;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM #{@cms}.articles a
        WHERE a.id = NEW.article_id AND a.thread = 'ticket'
      ) THEN
        RAISE EXCEPTION 'ticket_state_requires_ticket_article' USING ERRCODE = '23514';
      END IF;

      SELECT b.inner_id INTO ticket_inner_id
      FROM #{@cms}.article_bindings b
      WHERE b.id = NEW.article_binding_id AND b.article_id = NEW.article_id;

      SELECT l.state, l.first_published_at INTO ticket_lifecycle_state, first_published_at
      FROM #{@cms}.article_lifecycles l
      WHERE l.article_id = NEW.article_id;

      IF ticket_lifecycle_state IS NULL THEN
        RAISE EXCEPTION 'ticket_state_requires_article_lifecycle' USING ERRCODE = '23514';
      END IF;

      IF NEW.type = 'user'
         AND ticket_inner_id IS NULL
         AND (ticket_lifecycle_state = 'published' OR first_published_at IS NOT NULL) THEN
        RAISE EXCEPTION 'published_user_ticket_requires_public_number' USING ERRCODE = '23514';
      END IF;

      IF NEW.type IN ('worker', 'case') AND ticket_inner_id IS NOT NULL THEN
        RAISE EXCEPTION 'internal_ticket_cannot_have_public_number' USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $$
    """)
  end

  def down do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_state_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_inner_id integer;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM #{@cms}.articles a
        WHERE a.id = NEW.article_id AND a.thread = 'ticket'
      ) THEN
        RAISE EXCEPTION 'ticket_state_requires_ticket_article' USING ERRCODE = '23514';
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
  end
end
