defmodule GroupherServer.Repo.Migrations.ValidateMentionResourceOwnership do
  @moduledoc "Rejects typed Mention identities whose branch or Ticket kind mismatches the resource."

  use Ecto.Migration

  def up do
    execute("""
    CREATE FUNCTION cms.validate_mention_resource_ownership() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      source_article uuid;
      source_branch bigint;
      target_article uuid;
      target_branch bigint;
    BEGIN
      source_article := NEW.mentioner_article_id;
      source_branch := NEW.mentioner_branch_id;

      IF NEW.mentioner_type = 'comment' THEN
        SELECT c.article_id, c.branch_id INTO source_article, source_branch
        FROM cms.comments c JOIN cms.articles a ON a.id = c.article_id
        WHERE c.id = NEW.mentioner_comment_id AND c.thread = a.thread;

        IF source_article IS NULL THEN
          RAISE EXCEPTION 'Mention source Comment parent mismatch';
        END IF;
      END IF;

      IF NEW.mentioner_type = 'doc' OR
         (NEW.mentioner_type = 'comment' AND source_branch IS NOT NULL) THEN
        IF NOT EXISTS (
          SELECT 1 FROM cms.doc_branches b
          JOIN cms.article_bindings binding
            ON binding.article_id = source_article AND binding.community_id = b.community_id
          WHERE b.id = source_branch AND b.type = 'main'
        ) THEN
          RAISE EXCEPTION 'Mention source Doc main branch ownership mismatch';
        END IF;
      END IF;

      IF NEW.mentioner_type = 'ticket' AND NOT EXISTS (
        SELECT 1 FROM cms.ticket_states t
        WHERE t.article_id = source_article AND t.type = 'user'
      ) THEN
        RAISE EXCEPTION 'Mention source Ticket is not public User type';
      END IF;

      IF NEW.mentioned_scope = 'internal' THEN
        target_article := NEW.mentioned_article_id;
        target_branch := NEW.mentioned_branch_id;

        IF NEW.mentioned_type = 'comment' THEN
          SELECT c.article_id, c.branch_id INTO target_article, target_branch
          FROM cms.comments c JOIN cms.articles a ON a.id = c.article_id
          WHERE c.id = NEW.mentioned_comment_id AND c.thread = a.thread;

          IF target_article IS NULL THEN
            RAISE EXCEPTION 'Mention target Comment parent mismatch';
          END IF;
        END IF;

        IF NEW.mentioned_type = 'doc' OR
           (NEW.mentioned_type = 'comment' AND target_branch IS NOT NULL) THEN
          IF NOT EXISTS (
            SELECT 1 FROM cms.doc_branches b
            JOIN cms.article_bindings binding
              ON binding.article_id = target_article AND binding.community_id = b.community_id
            WHERE b.id = target_branch AND b.type = 'main'
          ) THEN
            RAISE EXCEPTION 'Mention target Doc main branch ownership mismatch';
          END IF;
        END IF;

        IF NEW.mentioned_type = 'ticket' AND NOT EXISTS (
          SELECT 1 FROM cms.ticket_states t
          WHERE t.article_id = target_article AND t.type = 'user'
        ) THEN
          RAISE EXCEPTION 'Mention target Ticket is not public User type';
        END IF;
      END IF;

      RETURN NEW;
    END
    $$
    """)

    execute("""
    CREATE TRIGGER artiment_mention_validate_ownership BEFORE INSERT OR UPDATE
    ON cms.artiment_mentions FOR EACH ROW
    EXECUTE FUNCTION cms.validate_mention_resource_ownership()
    """)
  end

  def down do
    execute("DROP TRIGGER artiment_mention_validate_ownership ON cms.artiment_mentions")
    execute("DROP FUNCTION cms.validate_mention_resource_ownership()")
  end
end
