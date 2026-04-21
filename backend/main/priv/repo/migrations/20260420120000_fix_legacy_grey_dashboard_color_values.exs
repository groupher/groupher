defmodule GroupherServer.Repo.Migrations.FixLegacyGreyDashboardColorValues do
  use Ecto.Migration

  @cms_prefix "cms"
  @layout_scalar_rainbow_keys [
    "primary_color",
    "sub_primary_color",
    "topbar_bg",
    "broadcast_bg",
    "broadcast_article_bg"
  ]
  @layout_array_rainbow_keys ["kanban_bg_colors"]

  def up do
    normalize_community_tag_colors()
    Enum.each(@layout_scalar_rainbow_keys, &normalize_dashboard_layout_scalar_rainbow_key/1)
    Enum.each(@layout_array_rainbow_keys, &normalize_dashboard_layout_array_rainbow_key/1)
  end

  def down do
    raise "irreversible migration"
  end

  defp normalize_community_tag_colors do
    execute("""
    UPDATE #{@cms_prefix}.community_tags
    SET color = CASE LOWER(color)
      WHEN 'grey' THEN 'black'
      WHEN 'gray' THEN 'black'
      ELSE LOWER(color)
    END
    WHERE color IS NOT NULL
      AND LOWER(color) IN ('grey', 'gray');
    """)
  end

  defp normalize_dashboard_layout_scalar_rainbow_key(key) do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{#{key}}',
      to_jsonb(
        CASE LOWER(layout->>'#{key}')
          WHEN 'grey' THEN 'black'
          WHEN 'gray' THEN 'black'
          ELSE LOWER(layout->>'#{key}')
        END
      )
    )
    WHERE layout IS NOT NULL
      AND layout ? '#{key}'
      AND layout->>'#{key}' IS NOT NULL
      AND LOWER(layout->>'#{key}') IN ('grey', 'gray');
    """)
  end

  defp normalize_dashboard_layout_array_rainbow_key(key) do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{#{key}}',
      COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(
              CASE LOWER(value)
                WHEN 'grey' THEN 'black'
                WHEN 'gray' THEN 'black'
                ELSE LOWER(value)
              END
            )
          )
          FROM jsonb_array_elements_text(layout->'#{key}') AS values(value)
        ),
        '[]'::jsonb
      )
    )
    WHERE layout IS NOT NULL
      AND layout ? '#{key}'
      AND jsonb_typeof(layout->'#{key}') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(layout->'#{key}') AS values(value)
        WHERE LOWER(value) IN ('grey', 'gray')
      );
    """)
  end
end
