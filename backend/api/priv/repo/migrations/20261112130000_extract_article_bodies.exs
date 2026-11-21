defmodule GroupherServer.Repo.Migrations.ExtractArticleBodies do
  use Ecto.Migration

  def up do
    execute(
      "LOCK TABLE cms.article_working_copies, cms.article_snapshots IN ACCESS EXCLUSIVE MODE"
    )

    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.article_working_copies)
         OR EXISTS (SELECT 1 FROM cms.article_snapshots) THEN
        RAISE EXCEPTION 'ArticleBody cutover requires empty content owners; no history migration';
      END IF;
    END $$;
    """)

    create table(:article_bodies, primary_key: false, prefix: "cms") do
      add(:id, :uuid, primary_key: true)

      add(:article_id, references(:articles, type: :uuid, prefix: "cms", on_delete: :delete_all),
        null: false
      )

      add(:type, :text, null: false)
      add(:json, :text, null: false)
      add(:schema_version, :integer, null: false, default: 1)
      add(:markdown, :text, null: false)
      add(:html, :text, null: false)
      add(:markdown_toc, :map, null: false)
      add(:plain_text, :text, null: false)
      add(:thumbnail, :map, null: false)
      add(:xml, :text)
      add(:rss, :text)
      timestamps()
    end

    create(
      constraint(:article_bodies, :article_bodies_shape,
        prefix: "cms",
        check: "type IN ('working_copy', 'snapshot') AND schema_version > 0"
      )
    )

    create(unique_index(:article_bodies, [:id, :article_id, :type], prefix: "cms"))
    create(index(:article_bodies, [:article_id], prefix: "cms"))

    for {table, type} <- [
          {"article_working_copies", "working_copy"},
          {"article_snapshots", "snapshot"}
        ] do
      execute("""
      ALTER TABLE cms.#{table}
        ADD COLUMN body_id uuid NOT NULL,
        ADD COLUMN body_type text GENERATED ALWAYS AS ('#{type}'::text) STORED,
        ADD CONSTRAINT #{table}_body_owner_fkey FOREIGN KEY (body_id, article_id, body_type)
          REFERENCES cms.article_bodies(id, article_id, type) ON DELETE RESTRICT,
        ADD CONSTRAINT #{table}_body_id_unique UNIQUE (body_id);
      """)

      for field <- ~w(json schema_version markdown html markdown_toc plain_text thumbnail xml rss) do
        execute("ALTER TABLE cms.#{table} DROP COLUMN body_#{field}")
      end
    end

    execute(
      "ALTER TABLE cms.article_working_copies ADD CONSTRAINT article_working_copies_revision_check CHECK (revision > 0)"
    )

    # The old combined check was removed with body_schema_version.
    execute(
      "ALTER TABLE cms.article_snapshots ADD CONSTRAINT article_snapshots_source_revision_check CHECK (source_revision > 0)"
    )

    execute("""
    CREATE FUNCTION cms.guard_article_body_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.type = 'snapshot' OR NEW.type IS DISTINCT FROM OLD.type
         OR NEW.article_id IS DISTINCT FROM OLD.article_id OR NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'ArticleBody identity and Snapshot content are immutable' USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END $$;
    """)

    execute("""
    CREATE TRIGGER article_bodies_immutable BEFORE UPDATE ON cms.article_bodies
      FOR EACH ROW EXECUTE FUNCTION cms.guard_article_body_update();
    """)

    execute("""
    CREATE FUNCTION cms.guard_working_copy_body_identity() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.body_id IS DISTINCT FROM OLD.body_id OR NEW.article_id IS DISTINCT FROM OLD.article_id THEN
        RAISE EXCEPTION 'WorkingCopy body ownership is immutable' USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END $$;
    """)

    execute("""
    CREATE TRIGGER article_working_copies_body_identity BEFORE UPDATE ON cms.article_working_copies
      FOR EACH ROW EXECUTE FUNCTION cms.guard_working_copy_body_identity();
    """)

    execute("""
    CREATE FUNCTION cms.delete_owned_article_body() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM cms.article_bodies WHERE id = OLD.body_id;
      RETURN OLD;
    END $$;
    """)

    for table <- ~w(article_working_copies article_snapshots) do
      execute(
        "CREATE TRIGGER #{table}_delete_body AFTER DELETE ON cms.#{table} FOR EACH ROW EXECUTE FUNCTION cms.delete_owned_article_body()"
      )
    end
  end

  def down do
    raise "ArticleBody cutover is irreversible; restore an approved empty baseline instead"
  end
end
