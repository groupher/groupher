defmodule GroupherServer.CMS.Dashboard.Fields do
  @moduledoc """
  KTV(key, type, value(default)) for dashboard macro/schema/type etc
  define once, we can get embed_schema fields/default_values/cast_values and GraphQL endpoint arg ready

  only general key/value like string/boolean are supported
  int/array of type are not supported, cuz it's hard to leverage between GraphQL/Schema/Types ..
  those cases need to manually add
  """

  alias GroupherServer.CMS.Dashboard.KanbanBoards

  @rainbow_colors [
    :black,
    :pink,
    :red,
    :orange,
    :yellow,
    :brown,
    :green_light,
    :green,
    :cyan,
    :cyan_light,
    :blue,
    :purple,
    :custom
  ]
  @kanban_bg_colors_default [:black, :yellow, :purple, :green, :red]
  @theme_presets [:default, :claude, :solarized, :hn, :custom]
  @default_wallpaper_type "gradient"
  @default_wallpaper_source "pink"
  @default_wallpaper_pattern_id "01"
  @default_wallpaper_pattern_tone "dark"
  @default_wallpaper_gradient_renderer "linear"
  @default_wallpaper_bg_size "cover"
  @default_wallpaper_texture_type "noise"
  # Single source of truth for dashboard enums.
  #
  # Internal business values stay as lowercase atoms:
  #   [:quora, :ph]
  #
  # They are expanded downstream into:
  # - Ecto.Enum values: [:quora, :ph] -> DB stores "quora" / "ph"
  # - GraphQL enum values: value(:quora), value(:ph) -> QUORA / PH
  @enum_values %{
    post_layout: [:quora, :ph, :masonry, :minimal, :cover],
    kanban_layout: [:classic, :waterfall],
    kanban_card_layout: [:simple, :full],
    doc_cover_layout: [
      :outline_columns,
      :outline_toc,
      :brief_cards,
      :cover_cards,
      :tile_cards,
      :stack_cards
    ],
    doc_faq_layout: [:flat, :collapse, :search_hint, :left_right],
    tag_layout: [:hash, :dot],
    inline_tag_layout: [:morandi, :soft, :solid, :border, :simple],
    avatar_layout: [:circle, :square],
    brand_layout: [:both, :logo, :text],
    community_layout: [:classic, :hero, :sidebar],
    nav_active_layout: [:text, :gray_bg, :soft_bg],
    broadcast_layout: [:default, :center],
    broadcast_article_layout: [:default, :simple],
    changelog_layout: [:classic, :simple],
    footer_layout: [:oneline, :group],
    header_layout: [:center, :right, :float],
    theme_preset: @theme_presets,
    rss_feed_type: [:digest, :full]
  }

  def kanban_bg_colors_default, do: @kanban_bg_colors_default
  def rainbow_colors, do: @rainbow_colors
  def theme_presets, do: @theme_presets
  def enum_values(key), do: Map.fetch!(@enum_values, key)

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
      [:blog, :boolean, true],
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
      [:theme_preset, :enum, :default],
      [:custom_theme_preset, :map, nil],
      [:kanban_bg_colors, {:array, :rainbow_color}, @kanban_bg_colors_default],
      [:kanban_boards, {:array, :kanban_board}, KanbanBoards.default_values_list()],
      [:post_layout, :enum, :quora],
      [:kanban_layout, :enum, :classic],
      [:kanban_card_layout, :enum, :simple],
      [:doc_cover_layout, :enum, :stack_cards],
      [:doc_faq_layout, :enum, :collapse],
      [:tag_layout, :enum, :hash],
      [:inline_tag_layout, :enum, :border],
      [:avatar_layout, :enum, :square],
      [:brand_layout, :enum, :both],
      [:community_layout, :enum, :classic],
      [:nav_active_layout, :enum, :text],
      [:topbar_enabled, :boolean, false],
      [:topbar_bg, :rainbow_color, :black],
      [:topbar_bg_custom_color, :string, ""],
      [:broadcast_layout, :enum, :default],
      [:broadcast_bg, :rainbow_color, :black],
      [:broadcast_custom_bg, :string, ""],
      [:broadcast_enable, :boolean, false],
      [:broadcast_article_layout, :enum, :default],
      [:broadcast_article_bg, :rainbow_color, :red],
      [:broadcast_article_custom_bg, :string, ""],
      [:broadcast_article_enable, :boolean, true],
      [:changelog_layout, :enum, :classic],
      [:footer_layout, :enum, :group],
      [:header_layout, :enum, :center],
      [:overlay_dark, :boolean, true]
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
      [:rss_feed_type, :enum, :digest],
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
      [:id, :string, ""],
      [:type, :string, "LINK"],
      [:title, :string, ""],
      [:url, :string, ""]
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
      [:type, :string, @default_wallpaper_type],
      [:source, :string, @default_wallpaper_source],
      [:type_dark, :string, @default_wallpaper_type],
      [:source_dark, :string, @default_wallpaper_source],

      # gradient
      [:has_pattern, :boolean, true],
      [:pattern_id, :string, @default_wallpaper_pattern_id],
      [:pattern_intensity, :integer, 50],
      [:pattern_tone, :string, @default_wallpaper_pattern_tone],
      [:has_texture, :boolean, false],
      [:has_pattern_dark, :boolean, true],
      [:pattern_id_dark, :string, @default_wallpaper_pattern_id],
      [:pattern_intensity_dark, :integer, 50],
      [:pattern_tone_dark, :string, @default_wallpaper_pattern_tone],
      [:has_texture_dark, :boolean, false],
      [
        :gradient,
        :map,
        %{
          "version" => 2,
          "renderer" => @default_wallpaper_gradient_renderer,
          "preset" => @default_wallpaper_source,
          "colors" => ["#FBEFDE", "#D8B9E3"],
          "angle" => 180,
          "spread" => 52
        }
      ],
      [
        :gradient_dark,
        :map,
        %{
          "version" => 2,
          "renderer" => @default_wallpaper_gradient_renderer,
          "preset" => @default_wallpaper_source,
          "colors" => ["#FBEFDE", "#D8B9E3"],
          "angle" => 180,
          "spread" => 52
        }
      ],

      # image
      [:bg_size, :string, @default_wallpaper_bg_size],
      [:bg_size_dark, :string, @default_wallpaper_bg_size],

      # global effects
      [:blur_intensity, :integer, 0],
      [:has_shadow, :boolean, false],
      [:brightness, :integer, 100],
      [:saturation, :integer, 100],
      [:blur_intensity_dark, :integer, 0],
      [:has_shadow_dark, :boolean, false],
      [:brightness_dark, :integer, 100],
      [:saturation_dark, :integer, 100],

      # renderer-specific config/effects
      [
        :texture,
        :map,
        %{"type" => @default_wallpaper_texture_type, "intensity" => 0, "params" => %{}}
      ],
      [
        :texture_dark,
        :map,
        %{"type" => @default_wallpaper_texture_type, "intensity" => 0, "params" => %{}}
      ]
    ]
  end
end
