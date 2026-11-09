defmodule GroupherServer.Repo.Migrations.RewriteTicketPublicArticleGuard do
  use Ecto.Migration

  @cms "cms"

  def up do
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
          AND s.public_visibility = 'published'
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
  end

  def down do
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
        WHERE s.article_id = NEW.article_id
          AND s.type = 'user'
          AND s.public_visibility = 'published'
          AND s.current_revision_id = NEW.revision_id
          AND b.inner_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'article_public_requires_published_user_ticket_revision'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)
  end
end
