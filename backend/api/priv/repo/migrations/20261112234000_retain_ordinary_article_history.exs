defmodule GroupherServer.Repo.Migrations.RetainOrdinaryArticleHistory do
  use Ecto.Migration

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles WHERE lower(thread::text) <> 'doc') THEN
        RAISE EXCEPTION 'Article history ownership requires cleared ordinary content; no history conversion';
      END IF;
    END $$;
    """)

    create table(:article_history_owners, primary_key: false, prefix: "cms") do
      add(:article_id, references(:articles, type: :uuid, prefix: "cms", on_delete: :restrict),
        primary_key: true
      )

      add(:community_id, references(:communities, prefix: "cms", on_delete: :restrict),
        primary_key: true
      )
    end

    create(index(:article_history_owners, [:community_id, :article_id], prefix: "cms"))

    execute("""
    CREATE FUNCTION cms.record_article_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF lower(NEW.thread::text) <> 'doc' THEN
        INSERT INTO cms.article_history_owners(article_id,community_id)
        VALUES(NEW.article_id,NEW.community_id) ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE TRIGGER record_article_history_owner AFTER INSERT OR UPDATE OF community_id ON cms.article_bindings
      FOR EACH ROW EXECUTE FUNCTION cms.record_article_history_owner()
    """)

    execute("""
    CREATE FUNCTION cms.guard_article_history_owner() RETURNS trigger LANGUAGE plpgsql AS $$
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

    execute("""
    CREATE TRIGGER guard_article_history_owner BEFORE UPDATE OR DELETE ON cms.article_history_owners
      FOR EACH ROW EXECUTE FUNCTION cms.guard_article_history_owner()
    """)
  end

  def down, do: raise("Article history retention is intentionally irreversible")
end
