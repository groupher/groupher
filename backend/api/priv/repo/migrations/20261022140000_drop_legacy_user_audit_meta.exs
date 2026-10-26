defmodule GroupherServer.Repo.Migrations.DropLegacyUserAuditMeta do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE account.users
    SET meta = COALESCE(meta, '{}'::jsonb)
      - 'has_illegal_articles'
      - 'illegal_articles'
      - 'has_illegal_comments'
      - 'illegal_comments'
    WHERE meta ?| ARRAY[
      'has_illegal_articles',
      'illegal_articles',
      'has_illegal_comments',
      'illegal_comments'
    ]
    """)
  end

  def down do
    raise "legacy user content audit metadata is intentionally irreversible"
  end
end
