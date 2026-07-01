defmodule GroupherServer.Repo.Migrations.RenameDocContentsToDocDocuments do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_contents') IS NOT NULL
         AND to_regclass('#{@prefix}.doc_documents') IS NULL
      THEN
        ALTER TABLE #{@prefix}.doc_contents RENAME TO doc_documents;
      END IF;
    END $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.doc_documents') IS NOT NULL
         AND to_regclass('#{@prefix}.doc_contents') IS NULL
      THEN
        ALTER TABLE #{@prefix}.doc_documents RENAME TO doc_contents;
      END IF;
    END $$;
    """)
  end
end
