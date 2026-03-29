defmodule GroupherServer.Repo.Migrations.RenameReceivedUserIdInUserEmotions do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'comments_users_emotions'
          AND column_name = 'recived_user_id'
      ) THEN
        ALTER TABLE cms.comments_users_emotions
        RENAME COLUMN recived_user_id TO received_user_id;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'articles_users_emotions'
          AND column_name = 'recived_user_id'
      ) THEN
        ALTER TABLE cms.articles_users_emotions
        RENAME COLUMN recived_user_id TO received_user_id;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comments_users_emotions_recived_user_id_fkey'
      ) THEN
        ALTER TABLE cms.comments_users_emotions
        RENAME CONSTRAINT comments_users_emotions_recived_user_id_fkey
        TO comments_users_emotions_received_user_id_fkey;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_users_emotions_recived_user_id_fkey'
      ) THEN
        ALTER TABLE cms.articles_users_emotions
        RENAME CONSTRAINT articles_users_emotions_recived_user_id_fkey
        TO articles_users_emotions_received_user_id_fkey;
      END IF;
    END
    $$;
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.comments_users_emotions_recived_user_id_index
    RENAME TO comments_users_emotions_received_user_id_index
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.articles_users_emotions_recived_user_id_index
    RENAME TO articles_users_emotions_received_user_id_index
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'comments_users_emotions'
          AND column_name = 'received_user_id'
      ) THEN
        ALTER TABLE cms.comments_users_emotions
        RENAME COLUMN received_user_id TO recived_user_id;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'articles_users_emotions'
          AND column_name = 'received_user_id'
      ) THEN
        ALTER TABLE cms.articles_users_emotions
        RENAME COLUMN received_user_id TO recived_user_id;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comments_users_emotions_received_user_id_fkey'
      ) THEN
        ALTER TABLE cms.comments_users_emotions
        RENAME CONSTRAINT comments_users_emotions_received_user_id_fkey
        TO comments_users_emotions_recived_user_id_fkey;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_users_emotions_received_user_id_fkey'
      ) THEN
        ALTER TABLE cms.articles_users_emotions
        RENAME CONSTRAINT articles_users_emotions_received_user_id_fkey
        TO articles_users_emotions_recived_user_id_fkey;
      END IF;
    END
    $$;
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.comments_users_emotions_received_user_id_index
    RENAME TO comments_users_emotions_recived_user_id_index
    """)

    execute("""
    ALTER INDEX IF EXISTS cms.articles_users_emotions_received_user_id_index
    RENAME TO articles_users_emotions_recived_user_id_index
    """)
  end
end
