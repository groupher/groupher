defmodule GroupherServer.Repo.Migrations.MigrateDashboardDocLayoutToCoverLayoutValues do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{doc_layout}',
      to_jsonb(
        CASE LOWER(layout->>'doc_layout')
          WHEN 'outline' THEN 'outline_toc'
          WHEN 'lists' THEN 'tile_cards'
          WHEN 'cards' THEN 'stack_cards'
          ELSE LOWER(layout->>'doc_layout')
        END
      )
    )
    WHERE layout IS NOT NULL
      AND layout ? 'doc_layout'
      AND layout->>'doc_layout' IS NOT NULL
      AND LOWER(layout->>'doc_layout') IN ('outline', 'lists', 'cards');
    """)
  end

  def down do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{doc_layout}',
      to_jsonb(
        CASE LOWER(layout->>'doc_layout')
          WHEN 'outline_toc' THEN 'outline'
          WHEN 'tile_cards' THEN 'lists'
          WHEN 'stack_cards' THEN 'cards'
          ELSE LOWER(layout->>'doc_layout')
        END
      )
    )
    WHERE layout IS NOT NULL
      AND layout ? 'doc_layout'
      AND layout->>'doc_layout' IS NOT NULL
      AND LOWER(layout->>'doc_layout') IN ('outline_toc', 'tile_cards', 'stack_cards');
    """)
  end
end
