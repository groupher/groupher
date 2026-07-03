defmodule GroupherServer.Repo.Migrations.RenameCommentReplyToCommentRefs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(table(:comments, prefix: @prefix), :reply_to_id, to: :reply_to_comment_id)

    rename(
      table(:comments_replies, prefix: @prefix),
      :reply_to_id,
      to: :reply_to_comment_id
    )

    execute("""
    ALTER INDEX IF EXISTS cms.comments_reply_to_id_inserted_at_index
    RENAME TO comments_reply_to_comment_id_inserted_at_index;
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.comments_replies_reply_to_id_index
    RENAME TO comments_replies_reply_to_comment_id_index;
    """)

    rename_constraint(:comments, :comments_reply_to_id_fkey, :comments_reply_to_comment_id_fkey)

    rename_constraint(
      :comments_replies,
      :comments_replies_reply_to_id_fkey,
      :comments_replies_reply_to_comment_id_fkey
    )
  end

  def down do
    rename_constraint(
      :comments_replies,
      :comments_replies_reply_to_comment_id_fkey,
      :comments_replies_reply_to_id_fkey
    )

    rename_constraint(:comments, :comments_reply_to_comment_id_fkey, :comments_reply_to_id_fkey)

    execute("""
    ALTER INDEX IF EXISTS cms.comments_replies_reply_to_comment_id_index
    RENAME TO comments_replies_reply_to_id_index;
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.comments_reply_to_comment_id_inserted_at_index
    RENAME TO comments_reply_to_id_inserted_at_index;
    """)

    rename(
      table(:comments_replies, prefix: @prefix),
      :reply_to_comment_id,
      to: :reply_to_id
    )

    rename(table(:comments, prefix: @prefix), :reply_to_comment_id, to: :reply_to_id)
  end

  defp rename_constraint(table, old_name, new_name) do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE n.nspname = '#{@prefix}'
          AND t.relname = '#{table}'
          AND c.conname = '#{old_name}'
      ) THEN
        ALTER TABLE #{@prefix}.#{table}
        RENAME CONSTRAINT #{old_name} TO #{new_name};
      END IF;
    END
    $$;
    """)
  end
end
