defmodule GroupherServer.Repo.Migrations.MigrateDashboardFooterLayoutSimpleToOneline do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET layout = jsonb_set(layout, '{footer_layout}', to_jsonb('oneline'::text))
    WHERE layout IS NOT NULL
      AND layout ? 'footer_layout'
      AND layout->>'footer_layout' = 'simple'
    """)
  end

  def down do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET layout = jsonb_set(layout, '{footer_layout}', to_jsonb('simple'::text))
    WHERE layout IS NOT NULL
      AND layout ? 'footer_layout'
      AND layout->>'footer_layout' = 'oneline'
    """)
  end
end
