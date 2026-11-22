defmodule GroupherServer.Repo.Migrations.AddFirstPublicationNotices do
  use Ecto.Migration

  # Freeze this migration's release values; later contract additions need their own migration.
  @previous_types ~w(upvote comment reply collect follow ticket_status ticket_update ticket_visibility)
  @current_types @previous_types ++ ["article_published"]

  def up do
    replace_type_check(@current_types)

    execute("""
    ALTER TABLE messaging.notices ADD CONSTRAINT notices_first_publication_shape_check CHECK (
      type <> 'article_published' OR
        (request_id IS NULL AND article_id IS NOT NULL AND comment_id IS NULL AND thread IS NOT NULL
          AND jsonb_array_length(from_users) = 1 AND from_users_count = 1)
    )
    """)

    replace_group_index(" AND type <> 'article_published'")
  end

  def down do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM messaging.notices WHERE type = 'article_published') THEN
        RAISE EXCEPTION 'cannot remove first-publication Notice contract while notices remain';
      END IF;
    END; $$
    """)

    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_first_publication_shape_check")
    replace_group_index("")
    replace_type_check(@previous_types)
  end

  defp replace_type_check(types) do
    values = Enum.map_join(types, ",", &"'#{&1}'")
    execute("ALTER TABLE messaging.notices DROP CONSTRAINT notices_type_check")

    execute("""
    ALTER TABLE messaging.notices ADD CONSTRAINT notices_type_check CHECK (
      (request_id IS NULL AND type IS NOT NULL AND type IN (#{values}))
      OR (request_id IS NOT NULL AND type IN ('invite','apply','result'))
    )
    """)
  end

  defp replace_group_index(extra_predicate) do
    execute("DROP INDEX messaging.notices_unread_group_uniq_idx")

    execute("""
    CREATE UNIQUE INDEX notices_unread_group_uniq_idx ON messaging.notices
      (user_id, type, COALESCE(thread, ''),
       COALESCE(article_id, '00000000-0000-0000-0000-000000000000'::uuid),
       COALESCE(comment_id, 0), date_trunc('hour', inserted_at AT TIME ZONE 'UTC'))
    WHERE read = false AND request_id IS NULL#{extra_predicate}
    """)
  end
end
