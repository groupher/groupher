defmodule GroupherServer.Repo.Migrations.RenameDocTreeRevisionsToSnapshots do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_tree_revisions') IS NOT NULL
         AND to_regclass('#{@prefix}.doc_tree_snapshots') IS NULL
      THEN
        ALTER TABLE #{@prefix}.doc_tree_revisions RENAME TO doc_tree_snapshots;
      END IF;
    END $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_tree_snapshots') IS NOT NULL
         AND to_regclass('#{@prefix}.doc_tree_revisions') IS NULL
      THEN
        ALTER TABLE #{@prefix}.doc_tree_snapshots RENAME TO doc_tree_revisions;
      END IF;
    END $$;
    """)
  end
end
