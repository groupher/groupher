defmodule GroupherServer.Repo.Migrations.ConvergeDocLifecycleAuthority do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DISABLE TRIGGER article_lifecycle_first_publication_guard"
    )

    execute("""
    INSERT INTO #{@cms}.article_lifecycles (
      article_id,
      thread,
      state,
      version,
      changed_at,
      first_published_at,
      archived_at,
      deleted_at,
      destroyed_at,
      inserted_at,
      updated_at
    )
    SELECT
      article_id,
      'doc',
      state,
      version,
      changed_at,
      first_published_at,
      archived_at,
      deleted_at,
      destroyed_at,
      inserted_at,
      updated_at
    FROM #{@cms}.doc_lifecycles
    """)

    execute(
      "ALTER TABLE #{@cms}.article_lifecycles ENABLE TRIGGER article_lifecycle_first_publication_guard"
    )

    execute("""
    INSERT INTO #{@cms}.article_history_owners (article_id, community_id)
    SELECT article_id, community_id FROM #{@cms}.docs_history_owners
    ON CONFLICT DO NOTHING
    """)

    execute("""
    INSERT INTO #{@cms}.article_history_owners (article_id, community_id)
    SELECT article_id, community_id FROM #{@cms}.article_bindings WHERE thread = 'doc'
    ON CONFLICT DO NOTHING
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.record_article_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO #{@cms}.article_history_owners(article_id,community_id)
      VALUES(NEW.article_id,NEW.community_id) ON CONFLICT DO NOTHING;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.guard_doc_binding_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.thread='doc' AND EXISTS (SELECT 1 FROM #{@cms}.articles WHERE id=OLD.article_id)
         AND NOT EXISTS (
           SELECT 1 FROM #{@cms}.article_history_owners
           WHERE article_id=OLD.article_id AND community_id=OLD.community_id
         ) THEN
        RAISE EXCEPTION 'Doc binding can be removed only after history ownership is retained' USING ERRCODE='23503', CONSTRAINT='doc_owner_binding_delete_guard';
      END IF;
      RETURN OLD;
    END $$
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.require_doc_owner_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target_id uuid; target_thread text;
    BEGIN
      IF TG_TABLE_NAME='articles' THEN target_id := NEW.id;
      ELSIF TG_OP='DELETE' THEN target_id := OLD.article_id;
      ELSE target_id := NEW.article_id;
      END IF;
      SELECT thread INTO target_thread FROM #{@cms}.articles WHERE id=target_id FOR UPDATE;
      IF target_thread='doc' AND NOT EXISTS (
        SELECT 1 FROM #{@cms}.article_bindings WHERE article_id=target_id AND thread='doc'
      ) AND NOT EXISTS (
        SELECT 1 FROM #{@cms}.article_history_owners WHERE article_id=target_id
      ) THEN
        RAISE EXCEPTION 'Doc requires an active binding or retained history ownership'
          USING ERRCODE='23514', CONSTRAINT='doc_owner_required_at_commit';
      END IF;
      RETURN NULL;
    END $$;
    """)

    execute("DROP TRIGGER IF EXISTS guard_docs_history_owner ON #{@cms}.docs_history_owners")
    execute("DROP FUNCTION IF EXISTS #{@cms}.guard_docs_history_owner()")

    execute("DROP TABLE #{@cms}.docs_history_owners")
    execute("DROP TABLE #{@cms}.doc_lifecycles")
    execute("DROP FUNCTION IF EXISTS #{@cms}.doc_lifecycle_first_publication_guard()")
  end

  def down do
    raise "Doc lifecycle authority convergence is intentionally irreversible"
  end
end
