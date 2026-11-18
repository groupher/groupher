defmodule GroupherServer.Repo.Migrations.CutoverMessagingNotices do
  use Ecto.Migration

  def up do
    alter table(:notifications, prefix: "messaging") do
      add(:request_type, :text)
      add(:request_id, :uuid)
      add(:request_revision, :bigint)
      add(:event_type, :text)
    end

    create(
      unique_index(
        :notifications,
        [:request_type, :request_id, :request_revision, :event_type, :user_id],
        prefix: "messaging",
        where: "request_id IS NOT NULL",
        name: :notifications_request_dedup_index
      )
    )

    create(index(:notifications, [:user_id, :request_type, :request_id], prefix: "messaging"))

    execute("""
    ALTER TABLE messaging.notifications
    ADD CONSTRAINT notifications_request_shape_check CHECK (
      (request_type IS NULL AND request_id IS NULL AND request_revision IS NULL AND event_type IS NULL)
      OR
      (request_type IN ('article_co_author', 'community_admin') AND request_id IS NOT NULL
       AND request_revision > 0 AND event_type IN ('created', 'decided', 'cancelled', 'expired')
       AND ((event_type = 'created' AND action IN ('invite', 'apply'))
         OR (event_type IN ('decided', 'cancelled', 'expired') AND action = 'result')))
    )
    """)

    execute("""
    ALTER TABLE messaging.notifications
    ADD CONSTRAINT notifications_actor_shape_check CHECK (
      (request_id IS NULL AND jsonb_array_length(from_users) > 0 AND from_users_count > 0)
      OR
      (request_id IS NOT NULL AND event_type = 'expired' AND action = 'result'
       AND jsonb_array_length(from_users) = 0 AND from_users_count = 0)
      OR
      (request_id IS NOT NULL AND NOT (event_type = 'expired' AND action = 'result')
       AND jsonb_array_length(from_users) > 0 AND from_users_count = 1)
    )
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM messaging.notifications
        WHERE action NOT IN (
          'upvote','UPVOTE','comment','COMMENT','reply','REPLY','collect','COLLECT',
          'follow','FOLLOW','ticket_status','TICKET_STATUS','ticket_update','TICKET_UPDATE',
          'ticket_visibility','TICKET_VISIBILITY','invite','apply','result'
        )
      ) THEN
        RAISE EXCEPTION 'unknown_notification_action_requires_explicit_mapping';
      END IF;
    END $$
    """)

    execute("""
    UPDATE messaging.notifications SET action = lower(action)
    WHERE action IN ('UPVOTE','COMMENT','REPLY','COLLECT','FOLLOW','TICKET_STATUS','TICKET_UPDATE','TICKET_VISIBILITY')
    """)

    # The original activity uniqueness predicate would also capture request
    # rows. Remove both legacy indexes before replacing them with request-safe
    # activity indexes inside this same transactional cutover.
    execute("DROP INDEX IF EXISTS messaging.notifications_unread_group_uniq_idx")
    execute("DROP INDEX IF EXISTS messaging.notifications_unread_lookup_idx")

    execute("ALTER TABLE messaging.notifications RENAME TO notices")
    execute("ALTER TABLE messaging.notices RENAME COLUMN action TO type")

    execute(
      "CREATE UNIQUE INDEX notices_unread_group_uniq_idx ON messaging.notices (user_id, type, COALESCE(thread, ''), COALESCE(article_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(comment_id, 0), date_trunc('hour', inserted_at AT TIME ZONE 'UTC')) WHERE read = false AND request_id IS NULL"
    )

    execute(
      "CREATE INDEX notices_unread_lookup_idx ON messaging.notices (user_id, type, thread, article_id, comment_id, inserted_at DESC, id DESC) WHERE read = false AND request_id IS NULL"
    )

    execute(
      "ALTER INDEX messaging.notifications_request_dedup_index RENAME TO notices_request_dedup_index"
    )

    execute(
      "ALTER INDEX messaging.notifications_user_id_request_type_request_id_index RENAME TO notices_user_request_index"
    )

    execute(
      "ALTER TABLE messaging.notices RENAME CONSTRAINT notifications_request_shape_check TO notices_request_shape_check"
    )

    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_request_shape_check")

    execute("""
    ALTER TABLE messaging.notices ADD CONSTRAINT notices_request_shape_check CHECK (
      (request_type IS NULL AND request_id IS NULL AND request_revision IS NULL AND event_type IS NULL)
      OR (request_type IN ('article_co_author','community_admin') AND request_id IS NOT NULL
          AND request_revision > 0 AND event_type IN ('created','decided','cancelled','expired')
          AND ((event_type = 'created' AND type IN ('invite','apply'))
            OR (event_type IN ('decided','cancelled','expired') AND type = 'result')))
    )
    """)

    execute("""
    ALTER TABLE messaging.notices ADD CONSTRAINT notices_type_check CHECK (
      (request_id IS NULL AND type IS NOT NULL AND type IN ('upvote','comment','reply','collect','follow','ticket_status','ticket_update','ticket_visibility'))
      OR (request_id IS NOT NULL AND type IN ('invite','apply','result'))
    )
    """)

    execute("""
    ALTER TABLE messaging.notices ADD CONSTRAINT notices_actor_shape_check CHECK (
      (request_id IS NULL AND jsonb_array_length(from_users) > 0 AND from_users_count > 0)
      OR (request_id IS NOT NULL AND event_type = 'expired' AND type = 'result'
          AND jsonb_array_length(from_users) = 0 AND from_users_count = 0)
      OR (request_id IS NOT NULL AND NOT (event_type = 'expired' AND type = 'result')
          AND jsonb_array_length(from_users) > 0 AND from_users_count = 1)
    )
    """)

    execute("ALTER TABLE messaging.notification_deliveries RENAME TO notice_dedup")
    execute("ALTER TABLE messaging.notice_dedup RENAME COLUMN notification_id TO notice_id")

    execute(
      "ALTER INDEX messaging.notification_deliveries_key_index RENAME TO notice_dedup_key_index"
    )

    execute(
      "ALTER INDEX messaging.notification_deliveries_notification_id_index RENAME TO notice_dedup_notice_id_index"
    )

    execute(
      "ALTER TABLE messaging.notice_dedup RENAME CONSTRAINT notification_deliveries_notification_id_fkey TO notice_dedup_notice_id_fkey"
    )

    execute("""
    UPDATE account.users
    SET mailbox = (mailbox - 'unread_notifications_count') ||
      jsonb_build_object('unread_notices_count', mailbox->'unread_notifications_count')
    WHERE mailbox ? 'unread_notifications_count'
    """)
  end

  def down do
    execute("""
    UPDATE account.users
    SET mailbox = (mailbox - 'unread_notices_count') ||
      jsonb_build_object('unread_notifications_count', mailbox->'unread_notices_count')
    WHERE mailbox ? 'unread_notices_count'
    """)

    execute(
      "ALTER TABLE messaging.notice_dedup RENAME CONSTRAINT notice_dedup_notice_id_fkey TO notification_deliveries_notification_id_fkey"
    )

    execute(
      "ALTER INDEX messaging.notice_dedup_notice_id_index RENAME TO notification_deliveries_notification_id_index"
    )

    execute(
      "ALTER INDEX messaging.notice_dedup_key_index RENAME TO notification_deliveries_key_index"
    )

    execute("ALTER TABLE messaging.notice_dedup RENAME COLUMN notice_id TO notification_id")
    execute("ALTER TABLE messaging.notice_dedup RENAME TO notification_deliveries")

    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_actor_shape_check")
    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_type_check")
    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_request_shape_check")

    execute(
      "ALTER INDEX messaging.notices_user_request_index RENAME TO notifications_user_id_request_type_request_id_index"
    )

    execute(
      "ALTER INDEX messaging.notices_request_dedup_index RENAME TO notifications_request_dedup_index"
    )

    execute("DROP INDEX messaging.notices_unread_lookup_idx")
    execute("DROP INDEX messaging.notices_unread_group_uniq_idx")

    execute("ALTER TABLE messaging.notices RENAME COLUMN type TO action")
    execute("ALTER TABLE messaging.notices RENAME TO notifications")

    execute("""
    ALTER TABLE messaging.notifications ADD CONSTRAINT notifications_request_shape_check CHECK (
      (request_type IS NULL AND request_id IS NULL AND request_revision IS NULL AND event_type IS NULL)
      OR (request_type IN ('article_co_author','community_admin') AND request_id IS NOT NULL
          AND request_revision > 0 AND event_type IN ('created','decided','cancelled','expired'))
    )
    """)

    execute(
      "CREATE UNIQUE INDEX notifications_unread_group_uniq_idx ON messaging.notifications (user_id, action, COALESCE(thread, ''), COALESCE(article_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(comment_id, 0), date_trunc('hour', inserted_at AT TIME ZONE 'UTC')) WHERE read = false"
    )

    execute(
      "CREATE INDEX notifications_unread_lookup_idx ON messaging.notifications (user_id, action, thread, article_id, comment_id, inserted_at DESC, id DESC) WHERE read = false"
    )

    drop(index(:notifications, [:user_id, :request_type, :request_id], prefix: "messaging"))

    drop(
      index(
        :notifications,
        [:request_type, :request_id, :request_revision, :event_type, :user_id],
        prefix: "messaging",
        name: :notifications_request_dedup_index
      )
    )

    alter table(:notifications, prefix: "messaging") do
      remove(:event_type)
      remove(:request_revision)
      remove(:request_id)
      remove(:request_type)
    end
  end
end
