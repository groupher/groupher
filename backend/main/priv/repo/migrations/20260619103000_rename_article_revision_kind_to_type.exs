defmodule GroupherServer.Repo.Migrations.RenameArticleSnapshotKindToType do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_snapshots'
          AND column_name = 'kind'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_snapshots'
          AND column_name = 'type'
      ) THEN
        ALTER TABLE "#{@prefix}"."article_snapshots" RENAME COLUMN "kind" TO "type";
      END IF;
    END $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_kind_index";|)

    execute(
      ~s|CREATE INDEX IF NOT EXISTS "article_snapshots_type_index" ON "#{@prefix}"."article_snapshots" ("type");|
    )

    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_snapshots" DROP CONSTRAINT IF EXISTS "article_snapshots_kind_check";|
    )

    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_snapshots" DROP CONSTRAINT IF EXISTS "article_snapshots_type_check";|
    )

    execute("""
    DELETE FROM "#{@prefix}"."article_snapshots"
    WHERE "type" NOT IN ('draft', 'published');
    """)

    execute("""
    ALTER TABLE "#{@prefix}"."article_snapshots"
    ADD CONSTRAINT "article_snapshots_type_check"
    CHECK ("type" IN ('draft', 'published'));
    """)
  end

  def down do
    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_snapshots" DROP CONSTRAINT IF EXISTS "article_snapshots_type_check";|
    )

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_snapshots'
          AND column_name = 'type'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_snapshots'
          AND column_name = 'kind'
      ) THEN
        ALTER TABLE "#{@prefix}"."article_snapshots" RENAME COLUMN "type" TO "kind";
      END IF;
    END $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_snapshots_type_index";|)

    execute(
      ~s|CREATE INDEX IF NOT EXISTS "article_snapshots_kind_index" ON "#{@prefix}"."article_snapshots" ("kind");|
    )

    execute("""
    ALTER TABLE "#{@prefix}"."article_snapshots"
    ADD CONSTRAINT "article_snapshots_kind_check"
    CHECK ("kind" IN ('draft', 'published', 'restore'));
    """)
  end
end
