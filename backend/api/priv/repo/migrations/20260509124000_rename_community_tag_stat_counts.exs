defmodule GroupherServer.Repo.Migrations.RenameCommunityTagStatCounts do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'posts_count'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'contents_count'
      ) THEN
        ALTER TABLE cms.community_tag_stats
          RENAME COLUMN posts_count TO contents_count;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'today_posts_count'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'today_contents_count'
      ) THEN
        ALTER TABLE cms.community_tag_stats
          RENAME COLUMN today_posts_count TO today_contents_count;
      END IF;
    END $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'contents_count'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'posts_count'
      ) THEN
        ALTER TABLE cms.community_tag_stats
          RENAME COLUMN contents_count TO posts_count;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'today_contents_count'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cms'
          AND table_name = 'community_tag_stats'
          AND column_name = 'today_posts_count'
      ) THEN
        ALTER TABLE cms.community_tag_stats
          RENAME COLUMN today_contents_count TO today_posts_count;
      END IF;
    END $$;
    """)
  end
end
