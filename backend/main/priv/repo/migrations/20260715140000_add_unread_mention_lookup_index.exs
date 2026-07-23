defmodule GroupherServer.Repo.Migrations.AddUnreadMentionLookupIndex do
  use Ecto.Migration

  def up do
    execute("""
    CREATE INDEX IF NOT EXISTS mentions_unread_lookup_idx
    ON messaging.mentions (to_user_id)
    WHERE read = false
    """)
  end

  def down do
    execute("DROP INDEX IF EXISTS messaging.mentions_unread_lookup_idx")
  end
end
