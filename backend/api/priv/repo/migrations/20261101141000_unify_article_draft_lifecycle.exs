defmodule GroupherServer.Repo.Migrations.UnifyArticleDraftLifecycle do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles) OR
         EXISTS (SELECT 1 FROM #{@cms}.article_lifecycles) OR
         EXISTS (SELECT 1 FROM #{@cms}.doc_lifecycles) OR
         EXISTS (SELECT 1 FROM #{@cms}.trashed_articles) OR
         EXISTS (SELECT 1 FROM #{@cms}.trashed_doc_articles) THEN
        RAISE EXCEPTION 'ticket_v2_article_cutover_requires_content_reset';
      END IF;
    END;
    $$
    """)

    alter table(:article_lifecycles, prefix: @cms) do
      add(:first_published_at, :timestamptz)
    end

    alter table(:doc_lifecycles, prefix: @cms) do
      add(:first_published_at, :timestamptz)
    end

    execute("ALTER TABLE #{@cms}.doc_lifecycles DROP CONSTRAINT doc_lifecycles_state_check")

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
      ADD CONSTRAINT article_lifecycles_state_check
      CHECK (state IN ('draft', 'published', 'archived', 'deleted', 'destroy')),
      ADD CONSTRAINT article_lifecycles_published_first_time_check
      CHECK (state <> 'published' OR first_published_at IS NOT NULL)
    """)

    execute("""
    ALTER TABLE #{@cms}.doc_lifecycles
      ADD CONSTRAINT doc_lifecycles_state_check
      CHECK (state IN ('draft', 'published', 'archived', 'deleted', 'destroy')),
      ADD CONSTRAINT doc_lifecycles_published_first_time_check
      CHECK (state <> 'published' OR first_published_at IS NOT NULL)
    """)

    execute(
      "ALTER TABLE #{@cms}.trashed_articles DROP CONSTRAINT trashed_articles_restore_state_check"
    )

    execute("""
    ALTER TABLE #{@cms}.trashed_articles
      ADD CONSTRAINT trashed_articles_restore_state_check
      CHECK (restore_state IN ('draft', 'published', 'archived'))
    """)

    execute(
      "ALTER TABLE #{@cms}.trashed_doc_articles DROP CONSTRAINT trashed_doc_articles_restore_state_check"
    )

    execute("""
    ALTER TABLE #{@cms}.trashed_doc_articles
      ADD CONSTRAINT trashed_doc_articles_restore_state_check
      CHECK (restore_state IN ('draft', 'published', 'archived'))
    """)

    create_first_publication_guard(
      "article_lifecycle_first_publication_guard",
      "article_lifecycles"
    )

    create_first_publication_guard("doc_lifecycle_first_publication_guard", "doc_lifecycles")
  end

  def down do
    execute(
      "DROP TRIGGER IF EXISTS doc_lifecycle_first_publication_guard ON #{@cms}.doc_lifecycles"
    )

    execute("DROP FUNCTION IF EXISTS #{@cms}.doc_lifecycle_first_publication_guard()")

    execute(
      "DROP TRIGGER IF EXISTS article_lifecycle_first_publication_guard ON #{@cms}.article_lifecycles"
    )

    execute("DROP FUNCTION IF EXISTS #{@cms}.article_lifecycle_first_publication_guard()")

    execute(
      "ALTER TABLE #{@cms}.doc_lifecycles DROP CONSTRAINT IF EXISTS doc_lifecycles_published_first_time_check"
    )

    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_published_first_time_check"
    )

    execute(
      "ALTER TABLE #{@cms}.doc_lifecycles DROP CONSTRAINT IF EXISTS doc_lifecycles_state_check"
    )

    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_state_check"
    )

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
      ADD CONSTRAINT article_lifecycles_state_check
      CHECK (state IN ('draft_only', 'published', 'archived', 'deleted', 'destroy'))
    """)

    execute("""
    ALTER TABLE #{@cms}.doc_lifecycles
      ADD CONSTRAINT doc_lifecycles_state_check
      CHECK (state IN ('draft_only', 'published', 'archived', 'deleted', 'destroy'))
    """)

    execute(
      "ALTER TABLE #{@cms}.trashed_articles DROP CONSTRAINT trashed_articles_restore_state_check"
    )

    execute("""
    ALTER TABLE #{@cms}.trashed_articles
      ADD CONSTRAINT trashed_articles_restore_state_check
      CHECK (restore_state IN ('draft_only', 'published', 'archived'))
    """)

    execute(
      "ALTER TABLE #{@cms}.trashed_doc_articles DROP CONSTRAINT trashed_doc_articles_restore_state_check"
    )

    execute("""
    ALTER TABLE #{@cms}.trashed_doc_articles
      ADD CONSTRAINT trashed_doc_articles_restore_state_check
      CHECK (restore_state IN ('draft_only', 'published', 'archived'))
    """)

    alter table(:doc_lifecycles, prefix: @cms) do
      remove(:first_published_at)
    end

    alter table(:article_lifecycles, prefix: @cms) do
      remove(:first_published_at)
    end
  end

  defp create_first_publication_guard(function_name, table_name) do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.#{function_name}()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF NEW.first_published_at IS NOT NULL THEN
          RAISE EXCEPTION 'first_published_at_is_database_owned'
            USING ERRCODE = '23514', CONSTRAINT = '#{function_name}';
        END IF;

        IF NEW.state = 'published' THEN
          NEW.first_published_at := date_trunc('second', transaction_timestamp());
        END IF;

        RETURN NEW;
      END IF;

      IF OLD.first_published_at IS NOT NULL THEN
        IF NEW.first_published_at IS DISTINCT FROM OLD.first_published_at THEN
          RAISE EXCEPTION 'first_published_at_is_immutable'
            USING ERRCODE = '23514', CONSTRAINT = '#{function_name}';
        END IF;

        RETURN NEW;
      END IF;

      IF NEW.first_published_at IS NOT NULL THEN
        RAISE EXCEPTION 'first_published_at_is_database_owned'
          USING ERRCODE = '23514', CONSTRAINT = '#{function_name}';
      END IF;

      IF NEW.state = 'published' THEN
        NEW.first_published_at := date_trunc('second', transaction_timestamp());
      END IF;

      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER #{function_name}
    BEFORE INSERT OR UPDATE ON #{@cms}.#{table_name}
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.#{function_name}()
    """)
  end
end
