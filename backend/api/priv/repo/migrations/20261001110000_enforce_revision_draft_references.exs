defmodule GroupherServer.Repo.Migrations.EnforceRevisionDraftReferences do
  use Ecto.Migration

  @moduledoc "Enforces Draft provenance by refusing to delete referenced Revisions."

  @prefix "cms"

  def up do
    alter_reference(
      "article_drafts",
      "base_revision_id",
      "article_drafts_base_revision_id_fkey",
      "restrict"
    )

    alter_reference(
      "doc_drafts",
      "base_revision_id",
      "doc_drafts_base_revision_id_fkey",
      "restrict"
    )

    alter_reference(
      "doc_drafts",
      "source_revision_id",
      "doc_drafts_source_revision_id_fkey",
      "restrict"
    )
  end

  def down do
    alter_reference(
      "article_drafts",
      "base_revision_id",
      "article_drafts_base_revision_id_fkey",
      "set null"
    )

    alter_reference(
      "doc_drafts",
      "base_revision_id",
      "doc_drafts_base_revision_id_fkey",
      "set null"
    )

    alter_reference(
      "doc_drafts",
      "source_revision_id",
      "doc_drafts_source_revision_id_fkey",
      "set null"
    )
  end

  defp alter_reference(table, column, constraint, action) do
    execute("ALTER TABLE #{@prefix}.#{table} DROP CONSTRAINT IF EXISTS #{constraint}")

    execute("""
    ALTER TABLE #{@prefix}.#{table}
    ADD CONSTRAINT #{constraint}
    FOREIGN KEY (#{column}) REFERENCES #{@prefix}.article_revisions(id)
    ON DELETE #{String.upcase(action)}
    """)
  end
end
