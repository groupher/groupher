defmodule GroupherServer.Repo.Migrations.AllowArticleHistoryPurgeOnGlobalDestroy do
  use Ecto.Migration

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION cms.guard_article_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' OR (
        NOT EXISTS (
          SELECT 1 FROM cms.community_lifecycles
          WHERE community_id=OLD.community_id AND state='destroy'
        ) AND NOT EXISTS (
          SELECT 1 FROM cms.article_lifecycles
          WHERE article_id=OLD.article_id AND state='destroy'
        )
      ) THEN
        RAISE EXCEPTION 'Article history is retained until Community destroy or global Article destroy' USING ERRCODE='23514';
      END IF;
      RETURN OLD;
    END $$
    """)
  end

  def down do
    execute("""
    CREATE OR REPLACE FUNCTION cms.guard_article_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' OR NOT EXISTS (
        SELECT 1 FROM cms.community_lifecycles
        WHERE community_id=OLD.community_id AND state='destroy'
      ) THEN
        RAISE EXCEPTION 'Article history is retained until Community destroy' USING ERRCODE='23514';
      END IF;
      RETURN OLD;
    END $$
    """)
  end
end
