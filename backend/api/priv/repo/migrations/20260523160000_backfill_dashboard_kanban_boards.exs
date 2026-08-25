defmodule GroupherServer.Repo.Migrations.BackfillDashboardKanbanBoards do
  use Ecto.Migration

  @prefix "cms"
  @default_boards ~s(["todo", "wip", "done"])

  def up do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET layout = jsonb_set(
      COALESCE(layout, '{}'::jsonb),
      '{kanban_boards}',
      '#{@default_boards}'::jsonb,
      true
    )
    WHERE layout IS NULL
       OR NOT (layout ? 'kanban_boards')
       OR layout->'kanban_boards' = 'null'::jsonb
       OR layout->'kanban_boards' = '[]'::jsonb
    """)
  end

  def down do
    :ok
  end
end
