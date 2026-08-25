defmodule GroupherServer.Repo.Migrations.MigrateDashboardCommunityLayoutValues do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{community_layout}',
      CASE layout->>'community_layout'
        WHEN 'header' THEN '"classic"'::jsonb
        WHEN 'tabber' THEN '"hero"'::jsonb
        ELSE layout->'community_layout'
      END,
      false
    )
    WHERE layout IS NOT NULL
      AND layout->>'community_layout' IN ('header', 'tabber')
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{community_layout}',
      CASE layout->>'community_layout'
        WHEN 'classic' THEN '"header"'::jsonb
        WHEN 'hero' THEN '"tabber"'::jsonb
        ELSE layout->'community_layout'
      END,
      false
    )
    WHERE layout IS NOT NULL
      AND layout->>'community_layout' IN ('classic', 'hero')
    """)
  end
end
