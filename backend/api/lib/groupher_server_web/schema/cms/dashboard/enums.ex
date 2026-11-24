defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Enums do
  @moduledoc """
  GraphQL dashboard enum types.

  Business position:

      Client
        -> Absinthe schema / Enums
        -> resolver or domain context
        -> GraphQL response
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_enum: 1, enum_values: 1]

  alias GroupherServer.CMS
  require CMS

  enum :dsb_section do
    @desc "Search engine metadata settings."
    value(:seo)
    @desc "Community feature switches."
    value(:enable)
    @desc "Allowed reactions by thread."
    value(:thread_emotions)
    @desc "Community layout settings."
    value(:layout)
    @desc "Community profile settings."
    value(:base_info)
    @desc "RSS publication settings."
    value(:rss)
    @desc "Custom names for community features."
    value(:name_alias)
    @desc "Header navigation links."
    value(:header_links)
    @desc "Footer navigation groups and links."
    value(:footer_links)
    @desc "Single-row footer links."
    value(:footer_oneline_links)
    @desc "Social profile links."
    value(:social_links)
    @desc "Media coverage links."
    value(:media_reports)
    @desc "Docs frequently asked questions."
    value(:doc_faq)
    @desc "External analytics integrations."
    value(:third_party_analytics)
    @desc "List pagination preferences."
    value(:pagi_mode)
  end

  enum :pagi_mode do
    @desc "Navigate by numbered pages."
    value(:page)
    @desc "Append results on request."
    value(:load_more)
    @desc "Append results as the viewer scrolls."
    value(:infinite_scroll)
  end

  enum :dsb_link_type do
    @desc "A single navigation destination."
    value(:link)
    @desc "A navigation group containing child links."
    value(:group)
  end

  enum :rainbow_color do
    @desc "Black palette swatch."
    value(:black)
    @desc "Pink palette swatch."
    value(:pink)
    @desc "Red palette swatch."
    value(:red)
    @desc "Orange palette swatch."
    value(:orange)
    @desc "Yellow palette swatch."
    value(:yellow)
    @desc "Brown palette swatch."
    value(:brown)
    @desc "Light green palette swatch."
    value(:green_light)
    @desc "Green palette swatch."
    value(:green)
    @desc "Cyan palette swatch."
    value(:cyan)
    @desc "Light cyan palette swatch."
    value(:cyan_light)
    @desc "Blue palette swatch."
    value(:blue)
    @desc "Purple palette swatch."
    value(:purple)
    @desc "Use a custom color instead of a named swatch."
    value(:custom)
  end

  enum(:kanban_board, do: enum_values(CMS.dashboard_kanban_boards_values()))

  dsb_enum(:post_layout)
  dsb_enum(:kanban_layout)
  dsb_enum(:kanban_card_layout)
  dsb_enum(:doc_cover_layout)
  dsb_enum(:doc_faq_layout)
  dsb_enum(:tag_layout)
  dsb_enum(:inline_tag_layout)
  dsb_enum(:avatar_layout)
  dsb_enum(:brand_layout)
  dsb_enum(:community_layout)
  dsb_enum(:nav_active_layout)
  dsb_enum(:broadcast_layout)
  dsb_enum(:broadcast_article_layout)
  dsb_enum(:changelog_layout)
  dsb_enum(:header_layout)
  dsb_enum(:footer_layout)
  dsb_enum(:theme_preset)
  dsb_enum(:rss_feed_type)

  enum :wallpaper_theme do
    @desc "Wallpaper for light mode."
    value(:light)
    @desc "Wallpaper for dark mode."
    value(:dark)
  end

  enum :wallpaper_type do
    @desc "Use a picture wallpaper."
    value(:picture)
    @desc "Use a gradient wallpaper."
    value(:gradient)
    @desc "Use an uploaded wallpaper."
    value(:upload)
    @desc "Disable the wallpaper."
    value(:none)
  end

  enum :custom_wallpaper_type do
    @desc "Render a custom gradient."
    value(:gradient)
    @desc "Render a custom picture."
    value(:picture)
  end

  enum :wallpaper_profile do
    @desc "Image for wide screens."
    value(:wide)
    @desc "Image for desktop screens."
    value(:desktop)
    @desc "Image for tablets."
    value(:tablet)
    @desc "Image for phones."
    value(:phone)
  end
end
