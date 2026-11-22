defmodule GroupherServer.Repo.Migrations.RemoveLegacyArticlePublicProjection do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("DROP TRIGGER IF EXISTS ticket_public_article_guard ON #{@cms}.article_publics")

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.articles a
        WHERE a.id = NEW.article_id AND a.thread = 'ticket'
      ) AND NOT EXISTS (
        SELECT 1
        FROM #{@cms}.ticket_states s
        JOIN #{@cms}.article_bindings b
          ON b.id = s.article_binding_id AND b.article_id = s.article_id
        JOIN #{@cms}.article_lifecycles l
          ON l.article_id = s.article_id AND l.thread = 'ticket' AND l.state = 'published'
        WHERE s.article_id = NEW.article_id
          AND s.type = 'user'
          AND b.inner_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'article_public_requires_published_user_ticket'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_public_article_guard
    BEFORE INSERT OR UPDATE OF article_id, snapshot_id ON #{@cms}.article_publics
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_public_article_guard()
    """)

    execute(
      "ALTER TABLE #{@cms}.article_publics DROP CONSTRAINT IF EXISTS article_publics_revision_id_fkey"
    )

    execute("DROP INDEX IF EXISTS #{@cms}.article_publics_revision_id_index")
    execute("DROP INDEX IF EXISTS #{@cms}.article_publics_active_at_index")

    alter table(:article_publics, prefix: @cms) do
      remove(:revision_id)
      remove(:body_hash)
      remove(:excerpt)
      remove(:active_at)
      remove(:publication_version)
    end
  end

  def down do
    alter table(:article_publics, prefix: @cms) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @cms, on_delete: :restrict)
      )

      add(:body_hash, :text)
      add(:excerpt, :text)
      add(:active_at, :timestamptz)
      add(:publication_version, :bigint, null: false, default: 1)
    end

    create(index(:article_publics, [:revision_id], prefix: @cms))
    create(index(:article_publics, [:active_at], prefix: @cms))

    execute("DROP TRIGGER IF EXISTS ticket_public_article_guard ON #{@cms}.article_publics")

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM #{@cms}.articles a
        WHERE a.id = NEW.article_id AND a.thread = 'ticket'
      ) AND NOT EXISTS (
        SELECT 1
        FROM #{@cms}.ticket_states s
        JOIN #{@cms}.article_bindings b
          ON b.id = s.article_binding_id AND b.article_id = s.article_id
        JOIN #{@cms}.article_lifecycles l
          ON l.article_id = s.article_id AND l.thread = 'ticket'
        JOIN #{@cms}.article_revisions r
          ON r.id = NEW.revision_id AND r.article_id = s.article_id
        WHERE s.article_id = NEW.article_id
          AND s.type = 'user'
          AND l.state = 'published'
          AND b.inner_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'article_public_requires_published_user_ticket_revision'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_public_article_guard
    BEFORE INSERT OR UPDATE OF article_id, revision_id ON #{@cms}.article_publics
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_public_article_guard()
    """)
  end
end
