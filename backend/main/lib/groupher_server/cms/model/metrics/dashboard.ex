defmodule GroupherServer.CMS.Model.Metrics.Dashboard do
  @moduledoc """
  KTV(key, type, value(default)) for dashboard macro/schema/type etc
  define once, we can get embed_schema fields/default_values/cast_values and GraphQL endpoint arg ready

  only general key/value like string/boolean are supported
  int/array of type are not supported, cuz it's hard to leverage between GraphQL/Schema/Types ..
  those cases need to manually add
  """

  @kanban_bg_colors_default ["BLACK", "YELLOW", "PURPLE", "GREEN", "RED"]

  def kanban_bg_colors_default, do: @kanban_bg_colors_default

  def layout_default do
    macro_schema(:layout)
    |> Enum.reduce(%{}, fn [key, _type, default], acc ->
      Map.put(acc, key, default)
    end)
    |> Map.put(:kanban_bg_colors, kanban_bg_colors_default())
  end

  def macro_schema(:enable) do
    [
      [:post, :boolean, true],
      [:kanban, :boolean, true],
      [:changelog, :boolean, true],
      # doc
      [:doc, :boolean, true],
      [:doc_last_update, :boolean, true],
      [:doc_reaction, :boolean, true],
      # about
      [:about, :boolean, true],
      [:about_techstack, :boolean, true],
      [:about_location, :boolean, true],
      [:about_links, :boolean, true],
      [:about_media_report, :boolean, true]
    ]
  end

  def macro_schema(:thread_emotions) do
    []
  end

  def macro_schema(:base_info) do
    [
      [:favicon, :string, ""],
      [:title, :string, ""],
      [:locale, :string, ""],
      [:logo, :string, ""],
      [:slug, :string, ""],
      [:desc, :string, ""],
      [:introduction, :string, ""],
      [:homepage, :string, ""],
      [:city, :string, ""],
      [:techstack, :string, ""]
    ]
  end

  # note: write kanban_bg_colors schema/graphql rules by itself
  def macro_schema(:layout) do
    [
      [:primary_color, :string, "BLACK"],
      [:sub_primary_color, :string, "BLACK"],
      [:kanban_bg_colors, {:array, :string}, @kanban_bg_colors_default],
      [:post_layout, :string, "quora"],
      [:kanban_layout, :string, "classic"],
      [:kanban_card_layout, :string, "simple"],
      [:doc_layout, :string, "cards"],
      [:doc_faq_layout, :string, "collapse"],
      [:tag_layout, :string, "hash"],
      [:inline_tag_layout, :string, "border"],
      [:avatar_layout, :string, "square"],
      [:brand_layout, :string, "both"],
      [:banner_layout, :string, "header"],
      [:topbar_layout, :string, "no"],
      [:topbar_bg, :string, "BLACK"],
      [:broadcast_layout, :string, "default"],
      [:broadcast_bg, :string, "BLACK"],
      [:broadcast_enable, :boolean, false],
      [:broadcast_article_layout, :string, "default"],
      [:broadcast_article_bg, :string, "RED"],
      [:broadcast_article_enable, :boolean, true],
      [:changelog_layout, :string, "classic"],
      [:footer_layout, :string, "group"],
      [:header_layout, :string, "center"],
      ## glow
      [:glow_type, :string, ""],
      [:glow_fixed, :boolean, true],
      [:glow_opacity, :string, "100"],
      [:dark_float, :boolean, true],

      ## blur
      [:gauss_blur, :integer, 100],
      [:gauss_blur_dark, :integer, 100]
    ]
  end

  def macro_schema(:seo) do
    [
      [:seo_enable, :boolean, true],
      [:og_site_name, :string, ""],
      [:og_title, :string, ""],
      [:og_description, :string, ""],
      [:og_url, :string, ""],
      [:og_image, :string, ""],
      [:og_locale, :string, ""],
      [:og_publisher, :string, ""],
      # twitter
      [:tw_title, :string, ""],
      [:tw_description, :string, ""],
      [:tw_url, :string, ""],
      [:tw_card, :string, ""],
      [:tw_site, :string, ""],
      [:tw_image, :string, ""],
      [:tw_image_width, :string, ""],
      [:tw_image_height, :string, ""]
    ]
  end

  def macro_schema(:rss) do
    [
      [:rss_feed_type, :string, "digest"],
      [:rss_feed_count, :integer, 20]
    ]
  end

  def macro_schema(:name_alias) do
    [
      [:slug, :string, ""],
      [:name, :string, ""],
      [:original, :string, ""],
      [:group, :string, ""]
    ]
  end

  def macro_schema(:header_link) do
    [
      [:title, :string, ""],
      [:link, :string, ""],
      [:group, :string, ""],
      [:group_index, :integer, 0],
      [:index, :integer, 0],
      [:is_hot, :boolean, false],
      [:is_new, :boolean, false]
    ]
  end

  def macro_schema(:footer_link) do
    [
      [:title, :string, ""],
      [:link, :string, ""],
      [:group, :string, ""],
      [:group_index, :integer, 0],
      [:index, :integer, 0],
      [:is_hot, :boolean, false],
      [:is_new, :boolean, false]
    ]
  end

  def macro_schema(:social_link) do
    [
      [:type, :string, ""],
      [:link, :string, ""]
    ]
  end

  def macro_schema(:faq_section) do
    [
      [:title, :string, ""],
      [:body, :string, ""],
      [:index, :integer, 0]
    ]
  end

  def macro_schema(:media_report) do
    [
      [:index, :integer, 0],
      [:title, :string, ""],
      [:favicon, :string, ""],
      [:site_name, :string, ""],
      [:description, :string, ""],
      [:url, :string, ""]
    ]
  end

  def macro_schema(:wallpaper) do
    [
      [:wallpaper_type, :string, "gradient"],
      [:wallpaper, :string, "pink"],

      # (custom) gradient
      [:has_pattern, :boolean, true],
      [:direction, :string, "bottom"],
      [:custom_color_value, :string, ""],

      # updated
      [:bg_size, :string, "cover"],
      [:upload_bg_image, :string, ""],

      # common
      [:has_blur, :boolean, false],
      [:has_shadow, :boolean, false]
    ]
  end
end
