defmodule GroupherServer.Repo.Migrations.RebuildNotificationsWithUnreadGroupUniqueIndex do
  use Ecto.Migration

  def up do
    execute("TRUNCATE TABLE messaging.notifications RESTART IDENTITY")

    execute("""
    CREATE UNIQUE INDEX notifications_unread_group_uniq_idx
    ON messaging.notifications (
      user_id,
      action,
      COALESCE(thread, ''),
      COALESCE(article_id, 0),
      COALESCE(comment_id, 0),
      date_trunc('hour', inserted_at AT TIME ZONE 'UTC')
    )
    WHERE read = false
    """)

    execute("""
    CREATE INDEX notifications_unread_lookup_idx
    ON messaging.notifications (
      user_id,
      action,
      thread,
      article_id,
      comment_id,
      inserted_at DESC,
      id DESC
    )
    WHERE read = false
    """)
  end

  def down do
    execute("DROP INDEX IF EXISTS messaging.notifications_unread_lookup_idx")
    execute("DROP INDEX IF EXISTS messaging.notifications_unread_group_uniq_idx")
  end
end
