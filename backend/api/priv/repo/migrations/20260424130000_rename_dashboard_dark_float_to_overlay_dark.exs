defmodule GroupherServer.Repo.Migrations.RenameDashboardDarkFloatToOverlayDark do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'dark_float' AND layout ? 'overlay_dark' THEN
        layout - 'dark_float'
      WHEN layout ? 'dark_float' THEN
        jsonb_set(
          layout - 'dark_float',
          '{overlay_dark}',
          layout->'dark_float'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'dark_float'
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'overlay_dark' AND layout ? 'dark_float' THEN
        layout - 'overlay_dark'
      WHEN layout ? 'overlay_dark' THEN
        jsonb_set(
          layout - 'overlay_dark',
          '{dark_float}',
          layout->'overlay_dark'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'overlay_dark'
    """)
  end
end
