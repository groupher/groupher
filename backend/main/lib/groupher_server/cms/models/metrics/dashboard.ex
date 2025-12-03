defmodule GroupherServer.CMS.Model.Metrics.Dashboard do
  @moduledoc """
  KTV(key, type, value(default)) for dashbaord macro/schema/type etc
  define once, we can get embed_schema fields/default_values/cast_values and GraphQL endpont arg ready

  only general key/value like string/boolean are supported
  int/array of type are not supported, cuz it's hard to leverage between GraphQL/Schama/Types ..
  those cases need to manually add
  """

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

  # note: write kanban_bg_colors rules by itself
  def macro_schema(:layout) do
    # manually add this:
    # [:kanban_bg_colors, {:array, :string}, []],

    [
      [:primary_color, :string, ""],
      [:post_layout, :string, ""],
      [:kanban_layout, :string, ""],
      [:kanban_card_layout, :string, ""],
      [:doc_layout, :string, ""],
      [:doc_faq_layout, :string, ""],
      [:tag_layout, :string, ""],
      [:avatar_layout, :string, ""],
      [:brand_layout, :string, ""],
      [:banner_layout, :string, ""],
      [:topbar_layout, :string, ""],
      [:topbar_bg, :string, ""],
      [:broadcast_layout, :string, ""],
      [:broadcast_bg, :string, ""],
      [:broadcast_enable, :boolean, false],
      [:broadcast_article_layout, :string, ""],
      [:broadcast_article_bg, :string, ""],
      [:broadcast_article_enable, :boolean, false],
      [:changelog_layout, :string, ""],
      [:footer_layout, :string, ""],
      [:header_layout, :string, ""],
      ## glow
      [:glow_type, :string, ""],
      [:glow_fixed, :boolean, false],
      [:glow_opacity, :string, ""],

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
