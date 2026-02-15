defmodule GroupherServerWeb.Schema.CMS.Metrics do
  @moduledoc """
  common metrics in queries
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields

  import Helper.Utils, only: [module_to_atom: 1]

  alias GroupherServer.CMS.Helper.ArticleEnums
  require ArticleEnums

  @doc """
  only used for reaction result, like: upvote/collect/watch ...
  """
  interface :article do
    # article 所包含的共同字段
    # field(:id, :id)
    field(:inner_id, :id)
    field(:title, :string)
    field(:views, :integer)
    field(:upvotes_count, :integer)
    field(:meta, :article_meta)
    field(:pending, :integer)

    # 这里只是遵循 absinthe 的规范，并不是指返回以下的字段
    resolve_type(fn parent_module, _ -> module_to_atom(parent_module) end)
  end

  article_thread_enums()

  @desc "emotion options of article"
  enum(:article_emotion, do: emotion_values())

  @desc "emotion options of comment"
  enum(:comment_emotion, do: emotion_values(:comment))

  enum :thread do
    article_values()
    value(:user)
    # home community
  end

  enum :dashboard_section do
    value(:seo)
    value(:wallpaper)
    value(:enable)
    value(:layout)
    value(:base_info)
    value(:rss)
    value(:name_alias)
    value(:header_links)
    value(:footer_links)
    value(:social_links)
    value(:media_reports)
    value(:faqs)
  end

  enum :content do
    article_values()
    value(:comment)
  end

  enum :when_enum do
    value(:today)
    value(:this_week)
    value(:this_month)
    value(:this_year)
  end

  enum :inserted_sort_enum do
    value(:asc_inserted)
    value(:desc_inserted)
  end

  enum :thread_sort_enum do
    value(:asc_index)
    value(:desc_index)
    value(:asc_inserted)
    value(:desc_inserted)
  end

  enum :sort_enum do
    value(:most_views)
    value(:asc_active)
    value(:desc_active)
    value(:most_updated)
    value(:most_upvotes)
    value(:most_stars)
    value(:most_comments)
    value(:least_views)
    value(:least_updated)
    value(:least_upvotes)
    value(:least_stars)
    value(:least_watched)
    value(:least_comments)
    value(:recent_updated)
  end

  enum :length_enum do
    value(:most_words)
    value(:least_words)
  end

  enum :rainbow_color do
    value(:black)
    value(:pink)
    value(:red)
    value(:orange)
    value(:yellow)
    value(:brown)
    value(:green)
    value(:green_light)
    value(:cyan)
    value(:cyan_light)
    value(:blue)
    value(:purple)
  end

  enum :article_cat_enum do
    enum_values(ArticleEnums.cat())
  end

  enum :article_state_enum do
    enum_values(ArticleEnums.state())
  end

  @desc "the filter mode for list comments"
  enum :comments_mode do
    value(:replies)
    value(:timeline)
  end

  input_object :comments_filter do
    pagination_args()
    field(:sort, :inserted_sort_enum, default_value: :asc_inserted)
  end

  input_object :communities_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    pagination_args()
    field(:sort, :sort_enum)
    field(:category, :string)
  end

  input_object :threads_filter do
    pagination_args()
    field(:sort, :thread_sort_enum)
  end

  input_object :article_tags_filter do
    field(:community, :string)
    field(:thread, :thread)
    pagination_args()
  end

  # for reindex usage
  input_object :article_tag_index do
    field(:id, :id)
    field(:index, :integer)
  end

  input_object :pagi_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    pagination_args()
    field(:sort, :sort_enum)
  end

  @desc "article_filter doc"
  input_object :article_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    field(:first, :integer)

    @desc "Matching a tag"
    field(:article_tag, :string)
    # field(:sort, :sort_input)
    field(:when, :when_enum)
    field(:sort, :sort_enum)
    # @desc "Matching a tag"
    # @desc "Added to the menu after this date"
    # field(:added_after, :datetime)
  end

  # @desc "article_filter doc"
  # input_object :paged_article_filter do
  #   @desc "limit of records (default 20), if first > 30, only return 30 at most"
  #   pagination_args()
  #   article_filter_fields()
  #   field(:sort, :sort_enum)
  # end

  @desc "posts_filter doc"
  input_object :paged_posts_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    pagination_args()
    article_filter_fields()
    field(:sort, :sort_enum)
  end

  @desc "kanban posts_filter doc"
  input_object :paged_kanban_posts_filter do
    pagination_args()
    field(:state, :article_state_enum)
  end

  @desc "changelogs_filter doc"
  input_object :paged_changelogs_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    pagination_args()
    article_filter_fields()
    field(:sort, :sort_enum)
  end

  @desc "docs_filter doc"
  input_object :paged_docs_filter do
    @desc "limit of records (default 20), if first > 30, only return 30 at most"
    pagination_args()
    article_filter_fields()
    field(:sort, :sort_enum)
  end

  @desc "blog_filter doc"
  input_object :paged_blogs_filter do
    pagination_args()
    article_filter_fields()
    field(:sort, :sort_enum)
  end

  @desc "common filter for upvoted articles"
  input_object :upvoted_articles_filter do
    field(:thread, :thread)
    pagination_args()
  end

  @desc "common filter for collect folders"
  input_object :collect_folders_filter do
    field(:thread, :thread)
    pagination_args()
  end

  @desc "common filter for collect articles"
  input_object :collected_articles_filter do
    field(:thread, :thread)
    pagination_args()
  end

  enum :report_content_type do
    article_values()
    value(:account)
    value(:comment)
    # value(:community)
  end

  @desc """
  abuse report filter
  """
  input_object :report_filter do
    field(:content_type, :report_content_type)
    field(:content_id, :id)
    pagination_args()
  end

  object :social do
    field(:platform, :string)
    field(:link, :string)
  end

  object :app_store do
    field(:platform, :string)
    field(:link, :string)
  end

  input_object :social_info do
    field(:platform, :string)
    field(:link, :string)
  end

  input_object :app_store_info do
    field(:platform, :string)
    field(:link, :string)
  end

  input_object :dashboard_alias_map do
    dashboard_gq_fields(:name_alias)
  end

  input_object :dashboard_link_map do
    dashboard_gq_fields(:header_link)
  end

  input_object :dashboard_social_link_map do
    dashboard_gq_fields(:social_link)
  end

  input_object :dashboard_media_report_map do
    dashboard_gq_fields(:media_report)
  end

  input_object :dashboard_faq_map do
    dashboard_gq_fields(:faq_section)
  end
end
