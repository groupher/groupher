defmodule GroupherServer.Repo.Migrations.RequireDocOwnerAtCommit do
  @moduledoc "Completes the Doc single-owner invariant across atomic aggregate creation."
  use Ecto.Migration

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles) THEN
        RAISE EXCEPTION 'Doc owner contract requires a fresh Article dataset';
      END IF;
    END $$;
    """)

    execute("""
    CREATE FUNCTION cms.require_doc_owner_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_id uuid; target_thread text;
    BEGIN
      IF TG_TABLE_NAME='articles' THEN target_id := NEW.id;
      ELSIF TG_OP='DELETE' THEN target_id := OLD.article_id;
      ELSE target_id := NEW.article_id;
      END IF;
      SELECT thread INTO target_thread FROM cms.articles WHERE id=target_id FOR UPDATE;
      IF target_thread='doc' AND NOT EXISTS (
        SELECT 1 FROM cms.article_bindings WHERE article_id=target_id AND thread='doc'
      ) THEN
        RAISE EXCEPTION 'stable Doc requires its owner binding in the same transaction'
          USING ERRCODE='23514', CONSTRAINT='doc_owner_required_at_commit';
      END IF;
      RETURN NULL;
    END $$;
    """)

    execute("""
    CREATE CONSTRAINT TRIGGER require_doc_owner_at_commit
    AFTER INSERT ON cms.articles DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION cms.require_doc_owner_at_commit()
    """)

    execute("""
    CREATE CONSTRAINT TRIGGER require_doc_owner_at_commit
    AFTER INSERT OR UPDATE OR DELETE ON cms.article_bindings DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION cms.require_doc_owner_at_commit()
    """)
  end

  def down do
    raise "Shared discussion owner invariants have no compatibility rollback"
  end
end
