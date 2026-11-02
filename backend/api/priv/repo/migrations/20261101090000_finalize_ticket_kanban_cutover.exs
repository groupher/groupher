defmodule GroupherServer.Repo.Migrations.FinalizeTicketKanbanCutover do
  use Ecto.Migration

  @prefix "cms"
  @default_boards ~s(["todo", "wip", "done"])
  @default_colors ~s(["yellow", "purple", "green"])
  @colors ~w(black pink red orange yellow brown green_light green cyan cyan_light blue purple custom)

  def up do
    execute("""
    DO $$
    DECLARE
      row record;
      boards jsonb;
      colors jsonb;
      migrated_boards jsonb;
      migrated_colors jsonb;
    BEGIN
      FOR row IN SELECT community_id, layout FROM #{@prefix}.community_dashboards LOOP
        boards := COALESCE(row.layout, '{}'::jsonb)->'kanban_boards';
        colors := COALESCE(row.layout, '{}'::jsonb)->'kanban_bg_colors';

        migrated_boards := '[]'::jsonb;
        IF jsonb_typeof(boards) = 'array' THEN
          SELECT COALESCE(jsonb_agg(to_jsonb(value) ORDER BY first_ordinal), '[]'::jsonb)
          INTO migrated_boards
          FROM (
            SELECT value, min(ordinal) AS first_ordinal
            FROM jsonb_array_elements_text(boards) WITH ORDINALITY AS item(value, ordinal)
            WHERE value IN ('todo', 'wip', 'done')
            GROUP BY value
          ) AS selected_boards;
        END IF;
        IF migrated_boards = '[]'::jsonb THEN
          migrated_boards := '#{@default_boards}'::jsonb;
        END IF;

        migrated_colors := '#{@default_colors}'::jsonb;
        IF jsonb_typeof(colors) = 'array' THEN
          IF jsonb_array_length(colors) = 5 THEN
            IF (colors->>1) = ANY(ARRAY[#{Enum.map_join(@colors, ", ", &"'#{&1}'")}]::text[])
               AND (colors->>2) = ANY(ARRAY[#{Enum.map_join(@colors, ", ", &"'#{&1}'")}]::text[])
               AND (colors->>3) = ANY(ARRAY[#{Enum.map_join(@colors, ", ", &"'#{&1}'")}]::text[]) THEN
              migrated_colors := jsonb_build_array(colors->1, colors->2, colors->3);
            END IF;
          END IF;
        END IF;

        UPDATE #{@prefix}.community_dashboards
        SET layout = jsonb_set(
          jsonb_set(COALESCE(row.layout, '{}'::jsonb), '{kanban_boards}', migrated_boards, true),
          '{kanban_bg_colors}', migrated_colors, true
        )
        WHERE community_id = row.community_id;
      END LOOP;
    END $$;
    """)

    drop(table(:kanban_states, prefix: @prefix))
  end

  def down do
    create table(:kanban_states, primary_key: false, prefix: @prefix) do
      add(
        :article_binding_id,
        references(:article_bindings, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:status, :string, null: false)
      add(:rank, :bigint)
      timestamps()
    end

    create(
      constraint(:kanban_states, :kanban_states_status_check,
        prefix: @prefix,
        check:
          "status IN ('default', 'backlog', 'todo', 'wip', 'done', 'resolved', 'reject', 'reject_dup', 'reject_no_plan', 'reject_repro', 'reject_stale')"
      )
    )
  end
end
