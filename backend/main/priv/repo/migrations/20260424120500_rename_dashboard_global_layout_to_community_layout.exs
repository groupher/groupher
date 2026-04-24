defmodule GroupherServer.Repo.Migrations.RenameDashboardGlobalLayoutToCommunityLayout do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'global_layout' AND layout ? 'community_layout' THEN
        layout - 'global_layout'
      WHEN layout ? 'global_layout' THEN
        jsonb_set(
          layout - 'global_layout',
          '{community_layout}',
          layout->'global_layout'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'global_layout'
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = CASE
      WHEN layout ? 'community_layout' AND layout ? 'global_layout' THEN
        layout - 'community_layout'
      WHEN layout ? 'community_layout' THEN
        jsonb_set(
          layout - 'community_layout',
          '{global_layout}',
          layout->'community_layout'
        )
      ELSE layout
    END
    WHERE layout IS NOT NULL AND layout ? 'community_layout'
    """)
  end
end
