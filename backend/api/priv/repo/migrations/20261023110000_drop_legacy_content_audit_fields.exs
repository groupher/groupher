defmodule GroupherServer.Repo.Migrations.DropLegacyContentAuditFields do
  use Ecto.Migration

  def up do
    execute("""
    ALTER TABLE cms.articles
      DROP COLUMN moderation_state,
      DROP COLUMN illegal_reason,
      DROP COLUMN illegal_words
    """)

    execute("""
    ALTER TABLE cms.doc_branch_states
      DROP COLUMN moderation_state,
      DROP COLUMN illegal_reason,
      DROP COLUMN illegal_words
    """)

    execute("ALTER TABLE cms.comments DROP COLUMN pending")

    execute("""
    UPDATE cms.comments
    SET meta = meta - 'is_legal' - 'illegal_reason' - 'illegal_words'
    """)
  end

  def down do
    raise "legacy content audit fields are intentionally irreversible"
  end
end
