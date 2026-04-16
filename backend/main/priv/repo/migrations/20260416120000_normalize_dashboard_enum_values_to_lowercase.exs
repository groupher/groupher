defmodule GroupherServer.Repo.Migrations.NormalizeDashboardEnumValuesToLowercase do
  use Ecto.Migration

  @cms_prefix "cms"
  @layout_scalar_enum_keys [
    "primary_color",
    "sub_primary_color",
    "post_layout",
    "kanban_layout",
    "kanban_card_layout",
    "doc_layout",
    "doc_faq_layout",
    "tag_layout",
    "inline_tag_layout",
    "avatar_layout",
    "brand_layout",
    "banner_layout",
    "topbar_bg",
    "broadcast_layout",
    "broadcast_bg",
    "broadcast_article_layout",
    "broadcast_article_bg",
    "changelog_layout",
    "footer_layout",
    "header_layout"
  ]
  @layout_array_enum_keys ["kanban_bg_colors", "kanban_boards"]

  def up do
    normalize_community_tag_colors()
    Enum.each(@layout_scalar_enum_keys, &normalize_dashboard_layout_scalar_key/1)
    Enum.each(@layout_array_enum_keys, &normalize_dashboard_layout_array_key/1)
    normalize_dashboard_rss_feed_type()
  end

  def down do
    raise "irreversible migration"
  end

  defp normalize_community_tag_colors do
    execute("""
    UPDATE #{@cms_prefix}.community_tags
    SET color = LOWER(color)
    WHERE color IS NOT NULL
    """)
  end

  defp normalize_dashboard_layout_scalar_key(key) do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(layout, '{#{key}}', to_jsonb(LOWER(layout->>'#{key}')))
    WHERE layout IS NOT NULL AND layout ? '#{key}' AND layout->>'#{key}' IS NOT NULL
    """)
  end

  defp normalize_dashboard_layout_array_key(key) do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET layout = jsonb_set(
      layout,
      '{#{key}}',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(LOWER(value)))
          FROM jsonb_array_elements_text(layout->'#{key}') AS values(value)
        ),
        '[]'::jsonb
      )
    )
    WHERE layout IS NOT NULL AND layout ? '#{key}' AND jsonb_typeof(layout->'#{key}') = 'array'
    """)
  end

  defp normalize_dashboard_rss_feed_type do
    execute("""
    UPDATE #{@cms_prefix}.community_dashboards
    SET rss = jsonb_set(rss, '{rss_feed_type}', to_jsonb(LOWER(rss->>'rss_feed_type')))
    WHERE rss IS NOT NULL AND rss ? 'rss_feed_type' AND rss->>'rss_feed_type' IS NOT NULL
    """)
  end
end
