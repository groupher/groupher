defmodule GroupherServer.Repo.Migrations.RenameDashboardBannerLayoutToGlobalLayout do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'banner_layout' THEN
        jsonb_set(
          layout - 'banner_layout',
          '{global_layout}',
          layout->'banner_layout'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'banner_layout'
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'global_layout' THEN
        jsonb_set(
          layout - 'global_layout',
          '{banner_layout}',
          layout->'global_layout'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'global_layout'
    """)
  end
end
