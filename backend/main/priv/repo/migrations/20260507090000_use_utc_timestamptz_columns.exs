defmodule GroupherServer.Repo.Migrations.UseUtcTimestamptzColumns do
  use Ecto.Migration

  def up do
    drop_notification_indexes()

    execute("""
    DO $$
    DECLARE
      column_record record;
    BEGIN
      SET TIME ZONE 'UTC';

      FOR column_record IN
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'timestamp without time zone'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_name <> 'schema_migrations'
        ORDER BY table_schema, table_name, ordinal_position
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamp with time zone USING %I AT TIME ZONE %L',
          column_record.table_schema,
          column_record.table_name,
          column_record.column_name,
          column_record.column_name,
          'UTC'
        );
      END LOOP;
    END $$;
    """)

    create_notification_indexes(:timestamptz)
  end

  def down do
    drop_notification_indexes()

    execute("""
    DO $$
    DECLARE
      column_record record;
    BEGIN
      SET TIME ZONE 'UTC';

      FOR column_record IN
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'timestamp with time zone'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_name <> 'schema_migrations'
        ORDER BY table_schema, table_name, ordinal_position
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamp without time zone USING %I AT TIME ZONE %L',
          column_record.table_schema,
          column_record.table_name,
          column_record.column_name,
          column_record.column_name,
          'UTC'
        );
      END LOOP;
    END $$;
    """)

    create_notification_indexes(:timestamp)
  end

  defp drop_notification_indexes do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('messaging.notifications_unread_lookup_idx') IS NOT NULL THEN
        DROP INDEX messaging.notifications_unread_lookup_idx;
      END IF;

      IF to_regclass('messaging.notifications_unread_group_uniq_idx') IS NOT NULL THEN
        DROP INDEX messaging.notifications_unread_group_uniq_idx;
      END IF;
    END $$;
    """)
  end

  defp create_notification_indexes(:timestamptz) do
    create_notification_indexes("date_trunc('hour', inserted_at AT TIME ZONE 'UTC')")
  end

  defp create_notification_indexes(:timestamp) do
    create_notification_indexes("date_trunc('hour', inserted_at)")
  end

  defp create_notification_indexes(grouped_hour_expr) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('messaging.notifications') IS NOT NULL THEN
        CREATE UNIQUE INDEX notifications_unread_group_uniq_idx
        ON messaging.notifications (
          user_id,
          action,
          COALESCE(thread, ''),
          COALESCE(article_id, 0),
          COALESCE(comment_id, 0),
          #{grouped_hour_expr}
        )
        WHERE read = false;

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
        WHERE read = false;
      END IF;
    END $$;
    """)
  end
end
