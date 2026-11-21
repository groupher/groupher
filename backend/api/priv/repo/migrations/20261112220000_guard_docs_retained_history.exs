defmodule GroupherServer.Repo.Migrations.GuardDocsRetainedHistory do
  use Ecto.Migration

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION cms.require_doc_owner_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_id uuid; target_thread text;
    BEGIN
      IF TG_TABLE_NAME='articles' THEN target_id := NEW.id;
      ELSIF TG_OP='DELETE' THEN target_id := OLD.article_id;
      ELSE target_id := NEW.article_id;
      END IF;
      SELECT thread INTO target_thread FROM cms.articles WHERE id=target_id FOR UPDATE;
      IF target_thread='doc' AND NOT EXISTS (
        SELECT 1 FROM cms.article_bindings WHERE article_id=target_id AND thread='doc'
      ) AND NOT (
        EXISTS (SELECT 1 FROM cms.docs_history_owners WHERE article_id=target_id)
        AND NOT EXISTS (SELECT 1 FROM cms.doc_lifecycles WHERE article_id=target_id)
        AND NOT EXISTS (SELECT 1 FROM cms.article_publics WHERE article_id=target_id)
        AND NOT EXISTS (SELECT 1 FROM cms.article_working_copies WHERE article_id=target_id)
        AND NOT EXISTS (SELECT 1 FROM cms.docs_queue_articles WHERE article_id=target_id)
      ) THEN
        RAISE EXCEPTION 'Doc requires an active binding or a purged historical owner'
          USING ERRCODE='23514', CONSTRAINT='doc_owner_required_at_commit';
      END IF;
      RETURN NULL;
    END $$;
    """)

    execute("""
    CREATE FUNCTION cms.guard_docs_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM cms.article_bindings
          WHERE article_id=NEW.article_id AND community_id=NEW.community_id AND thread='doc') THEN
          RAISE EXCEPTION 'Doc history owner must match its initial binding' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
      ELSIF TG_OP='UPDATE' THEN
        RAISE EXCEPTION 'Doc history ownership is immutable' USING ERRCODE='23514';
      ELSE
        IF NOT EXISTS (SELECT 1 FROM cms.community_lifecycles WHERE community_id=OLD.community_id AND state='destroy') THEN
          RAISE EXCEPTION 'Doc history is retained until Community destroy' USING ERRCODE='23514';
        END IF;
        RETURN OLD;
      END IF;
    END $$;
    """)

    execute(
      "CREATE TRIGGER guard_docs_history_owner BEFORE INSERT OR UPDATE OR DELETE ON cms.docs_history_owners FOR EACH ROW EXECUTE FUNCTION cms.guard_docs_history_owner()"
    )
  end

  def down do
    raise "Docs retained history does not restore the retired binding requirement"
  end
end
