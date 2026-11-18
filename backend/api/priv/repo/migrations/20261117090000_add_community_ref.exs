defmodule GroupherServer.Repo.Migrations.AddCommunityRef do
  use Ecto.Migration

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    alter table(:communities, prefix: "cms") do
      add(:ref, :text)
    end

    create(unique_index(:communities, [:ref], prefix: "cms", name: :communities_ref_index))
    flush()

    execute("""
    CREATE FUNCTION cms.assign_community_ref() RETURNS trigger AS $$
    DECLARE extension_schema text; random_bytes bytea;
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.ref IS NOT NULL AND NEW.ref IS DISTINCT FROM OLD.ref THEN
          RAISE EXCEPTION 'community ref is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END IF;
      PERFORM pg_advisory_xact_lock(hashtext('cms.community.ref'));
      SELECT n.nspname INTO STRICT extension_schema FROM pg_catalog.pg_extension e
      JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto';
      LOOP
        EXECUTE format('SELECT %I.gen_random_bytes(16)', extension_schema) INTO random_bytes;
        NEW.ref := 'cm_' || encode(random_bytes, 'hex');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM cms.communities WHERE ref = NEW.ref);
      END LOOP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SET search_path = pg_catalog
    """)

    execute("""
    CREATE TRIGGER communities_ref_guard BEFORE INSERT OR UPDATE OF ref
    ON cms.communities FOR EACH ROW EXECUTE FUNCTION cms.assign_community_ref()
    """)

    execute("""
    DO $$
    DECLARE row_id bigint; candidate text; extension_schema text; random_bytes bytea;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('cms.community.ref'));
      SELECT n.nspname INTO STRICT extension_schema FROM pg_catalog.pg_extension e
      JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto';
      FOR row_id IN SELECT id FROM cms.communities WHERE ref IS NULL ORDER BY id LOOP
        LOOP
          EXECUTE format('SELECT %I.gen_random_bytes(16)', extension_schema) INTO random_bytes;
          candidate := 'cm_' || encode(random_bytes, 'hex');
          BEGIN
            UPDATE cms.communities SET ref = candidate WHERE id = row_id AND ref IS NULL;
            EXIT;
          EXCEPTION WHEN unique_violation THEN
            NULL;
          END;
        END LOOP;
      END LOOP;
    END $$
    """)

    execute("ALTER TABLE cms.communities ALTER COLUMN ref SET NOT NULL")
  end

  def down do
    execute("DROP TRIGGER communities_ref_guard ON cms.communities")
    execute("DROP FUNCTION cms.assign_community_ref()")
    drop(index(:communities, [:ref], prefix: "cms", name: :communities_ref_index))

    alter table(:communities, prefix: "cms") do
      remove(:ref)
    end
  end
end
