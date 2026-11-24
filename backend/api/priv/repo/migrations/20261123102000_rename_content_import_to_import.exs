defmodule GroupherServer.Repo.Migrations.RenameContentImportToImport do
  use Ecto.Migration

  @prefix "cms"
  def up do
    rename(table(:content_import_connections, prefix: @prefix),
      to: table(:import_connections, prefix: @prefix)
    )

    rename(table(:content_import_jobs, prefix: @prefix),
      to: table(:import_jobs, prefix: @prefix)
    )

    rename(table(:content_import_job_items, prefix: @prefix),
      to: table(:import_job_items, prefix: @prefix)
    )

    rename(table(:content_import_job_bodies, prefix: @prefix),
      to: table(:import_job_bodies, prefix: @prefix)
    )

    rename(table(:content_import_source_mappings, prefix: @prefix),
      to: table(:import_source_mappings, prefix: @prefix)
    )

    rename_prefixed_constraints("content_import_", "import_")
    rename_prefixed_indexes("content_import_", "import_")
  end

  def down do
    rename_prefixed_constraints("import_", "content_import_")
    rename_prefixed_indexes("import_", "content_import_")

    rename(table(:import_connections, prefix: @prefix),
      to: table(:content_import_connections, prefix: @prefix)
    )

    rename(table(:import_jobs, prefix: @prefix),
      to: table(:content_import_jobs, prefix: @prefix)
    )

    rename(table(:import_job_items, prefix: @prefix),
      to: table(:content_import_job_items, prefix: @prefix)
    )

    rename(table(:import_job_bodies, prefix: @prefix),
      to: table(:content_import_job_bodies, prefix: @prefix)
    )

    rename(table(:import_source_mappings, prefix: @prefix),
      to: table(:content_import_source_mappings, prefix: @prefix)
    )
  end

  defp rename_prefixed_constraints(from, to) do
    execute("""
    DO $$
    DECLARE item record;
    BEGIN
      FOR item IN
        SELECT rel.relname AS table_name, con.conname AS constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = '#{@prefix}'
          AND rel.relname = ANY (ARRAY[#{table_names_sql()}])
          AND left(con.conname, length('#{from}')) = '#{from}'
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
          '#{@prefix}',
          item.table_name,
          item.constraint_name,
          replace(item.constraint_name, '#{from}', '#{to}')
        );
      END LOOP;
    END $$;
    """)
  end

  defp rename_prefixed_indexes(from, to) do
    execute("""
    DO $$
    DECLARE item record;
    BEGIN
      FOR item IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = '#{@prefix}'
          AND tablename = ANY (ARRAY[#{table_names_sql()}])
          AND left(indexname, length('#{from}')) = '#{from}'
      LOOP
        EXECUTE format(
          'ALTER INDEX %I.%I RENAME TO %I',
          '#{@prefix}',
          item.indexname,
          replace(item.indexname, '#{from}', '#{to}')
        );
      END LOOP;
    END $$;
    """)
  end

  defp table_names_sql do
    ~w(import_connections import_jobs import_job_items import_job_bodies import_source_mappings)
    |> Enum.map_join(", ", &"'#{&1}'")
  end
end
