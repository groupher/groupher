defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Enums do
  @moduledoc """
  GraphQL dashboard enum types.
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_enum: 1, enum_values: 1]

  alias GroupherServer.CMS

  alias CMS.Dashboard.KanbanBoards

  require KanbanBoards

  enum :dsb_section do
    value(:seo)
    value(:wallpaper)
    value(:enable)
    value(:thread_emotions)
    value(:layout)
    value(:base_info)
    value(:rss)
    value(:name_alias)
    value(:header_links)
    value(:footer_links)
    value(:footer_oneline_links)
    value(:social_links)
    value(:media_reports)
    value(:doc_faq)
  end

  enum :dsb_link_type do
    value(:link)
    value(:group)
  end

  enum :rainbow_color do
    value(:black)
    value(:pink)
    value(:red)
    value(:orange)
    value(:yellow)
    value(:brown)
    value(:green_light)
    value(:green)
    value(:cyan)
    value(:cyan_light)
    value(:blue)
    value(:purple)
    value(:custom)
  end

  enum(:kanban_board, do: enum_values(KanbanBoards.values()))

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
end
