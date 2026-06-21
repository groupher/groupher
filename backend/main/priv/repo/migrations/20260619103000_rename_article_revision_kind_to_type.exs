defmodule GroupherServer.Repo.Migrations.RenameArticleRevisionKindToType do
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
          AND table_name = 'article_revisions'
          AND column_name = 'kind'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_revisions'
          AND column_name = 'type'
      ) THEN
        ALTER TABLE "#{@prefix}"."article_revisions" RENAME COLUMN "kind" TO "type";
      END IF;
    END $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_revisions_kind_index";|)

    execute(
      ~s|CREATE INDEX IF NOT EXISTS "article_revisions_type_index" ON "#{@prefix}"."article_revisions" ("type");|
    )

    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_revisions" DROP CONSTRAINT IF EXISTS "article_revisions_kind_check";|
    )

    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_revisions" DROP CONSTRAINT IF EXISTS "article_revisions_type_check";|
    )

    execute("""
    DELETE FROM "#{@prefix}"."article_revisions"
    WHERE "type" NOT IN ('draft', 'published');
    """)

    execute("""
    ALTER TABLE "#{@prefix}"."article_revisions"
    ADD CONSTRAINT "article_revisions_type_check"
    CHECK ("type" IN ('draft', 'published'));
    """)
  end

  def down do
    execute(
      ~s|ALTER TABLE "#{@prefix}"."article_revisions" DROP CONSTRAINT IF EXISTS "article_revisions_type_check";|
    )

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_revisions'
          AND column_name = 'type'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'article_revisions'
          AND column_name = 'kind'
      ) THEN
        ALTER TABLE "#{@prefix}"."article_revisions" RENAME COLUMN "type" TO "kind";
      END IF;
    END $$;
    """)

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."article_revisions_type_index";|)

    execute(
      ~s|CREATE INDEX IF NOT EXISTS "article_revisions_kind_index" ON "#{@prefix}"."article_revisions" ("kind");|
    )

    execute("""
    ALTER TABLE "#{@prefix}"."article_revisions"
    ADD CONSTRAINT "article_revisions_kind_check"
    CHECK ("kind" IN ('draft', 'published', 'restore'));
    """)
  end
end
