defmodule GroupherServer.Repo.Migrations.NormalizeCommentReplyThreadValues do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms_prefix}.normalize_thread_jsonb(data jsonb)
    RETURNS jsonb
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT
        CASE jsonb_typeof(data)
          WHEN 'object' THEN (
            SELECT jsonb_object_agg(
              key,
              CASE
                WHEN key = 'thread' AND jsonb_typeof(value) = 'string' THEN to_jsonb(LOWER(value #>> '{}'))
                ELSE #{@cms_prefix}.normalize_thread_jsonb(value)
              END
            )
            FROM jsonb_each(data)
          )
          WHEN 'array' THEN (
            SELECT jsonb_agg(#{@cms_prefix}.normalize_thread_jsonb(value))
            FROM jsonb_array_elements(data)
          )
          ELSE data
        END
    $$;
    """)

    execute("""
    UPDATE #{@cms_prefix}.comments
    SET replies = #{@cms_prefix}.normalize_thread_jsonb(replies)
    WHERE replies IS NOT NULL
    """)

    execute("DROP FUNCTION #{@cms_prefix}.normalize_thread_jsonb(jsonb)")
  end

  def down do
    raise "irreversible migration"
  end
end
