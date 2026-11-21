defmodule GroupherServer.Repo.Migrations.RenameDocScopeAndChangeTypes do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.article_working_copies RENAME COLUMN scope_kind TO scope_type")
    execute("ALTER TABLE cms.docs_queue_tree_changes RENAME COLUMN change_kind TO change_type")

    execute("""
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'article_working_copies_scope_kind_check'
      ) THEN
        ALTER TABLE cms.article_working_copies
        RENAME CONSTRAINT article_working_copies_scope_kind_check
        TO article_working_copies_scope_type_check;
      END IF;
    END $$;
    """)

    execute("""
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'article_working_copies_article_id_scope_kind_scope_id_index'
      ) THEN
        ALTER INDEX cms.article_working_copies_article_id_scope_kind_scope_id_index
        RENAME TO article_working_copies_article_id_scope_type_scope_id_index;
      END IF;
    END $$;
    """)
  end

  def down do
    raise "Doc scope and change type naming has no compatibility rollback"
  end
end
