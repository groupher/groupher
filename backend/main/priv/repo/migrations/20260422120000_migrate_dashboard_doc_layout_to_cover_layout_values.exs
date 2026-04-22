defmodule GroupherServer.Repo.Migrations.MigrateDashboardDocLayoutToCoverLayoutValues do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = (layout - 'doc_layout') || jsonb_build_object(
      'doc_cover_layout',
      CASE LOWER(layout->>'doc_layout')
        WHEN 'outline' THEN 'outline_toc'
        WHEN 'lists' THEN 'tile_cards'
        WHEN 'cards' THEN 'stack_cards'
        ELSE 'stack_cards'
      END
    )
    WHERE layout IS NOT NULL
      AND layout ? 'doc_layout'
      AND layout->>'doc_layout' IS NOT NULL;
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = (layout - 'doc_cover_layout') || jsonb_build_object(
      'doc_layout',
      CASE LOWER(layout->>'doc_cover_layout')
        WHEN 'outline_toc' THEN 'outline'
        WHEN 'tile_cards' THEN 'lists'
        WHEN 'stack_cards' THEN 'cards'
        ELSE 'outline'
      END
    )
    WHERE layout IS NOT NULL
      AND layout ? 'doc_cover_layout'
      AND layout->>'doc_cover_layout' IS NOT NULL;
    """)
  end
end
