defmodule GroupherServerWeb.Schema.CMS.Metrics do
  @moduledoc """
  common metrics in queries
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields
  import Helper.Utils, only: [module_to_atom: 1]

  alias GroupherServer.CMS

  alias CMS.Artiment.{Enums, Threads}

  require Enums
  require Threads

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
    field(:cover_url, :string)
    field(:cover_url_dark, :string)

    # 这里只是遵循 absinthe 的规范，并不是指返回以下的字段
    resolve_type(fn parent_module, _ -> module_to_atom(parent_module) end)
  end

  article_thread_enums()

  @desc "emotion options of article"
  enum(:article_emotion, do: emotion_values())

  @desc "emotion options of comment"
  enum(:comment_emotion, do: emotion_values(:comment))

  @desc "emotion options used by API output"
  enum(:emotion_type, do: emotion_values(:all))

  enum :thread do
    enum_values(Threads.values())
  end

  enum :content do
    article_values()
    value(:comment)
  end

  enum :mention_type do
    article_values()
    value(:comment)
    value(:user)
    @desc "External URL mentions only; internal URLs are normalized to concrete content types."
    value(:url)
  end

  enum :mention_scope do
    value(:internal)
    value(:external)
  end

  enum :mention_case do
    value(:inline_mention)
    value(:link)
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
    value(:desc_inserted)
    value(:most_views)
    value(:asc_active)
    value(:desc_active)
    value(:most_stars)
    value(:least_views)
    value(:least_stars)
  end

  enum :length_enum do
    value(:most_words)
    value(:least_words)
  end

  enum :article_order_enum do
    value(:upvotes)
    value(:comments)
    value(:views)
    value(:publish)
  end

  enum(:article_cat_enum, do: enum_values(Enums.cat()))
  enum(:article_status_enum, do: enum_values(Enums.status()))

  import_types(GroupherServerWeb.Schema.CMS.Dashboard.Metrics)

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

  # for reindex usage
  input_object :reindex_tag_input do
    field(:id, :id)
    field(:index, :integer)
  end

  input_object :reindex_community_tag_input do
    field(:id, non_null(:id))
    field(:group_id, non_null(:id))
    field(:index, non_null(:integer))
  end

  input_object :reindex_community_tag_group_input do
    field(:id, non_null(:id))
    field(:index, non_null(:integer))
  end

  input_object :article_ref_input do
    field(:inner_id, non_null(:id))
    field(:community, non_null(:string))
    field(:thread, :thread)
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
    field(:status, :article_status_enum)
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
end
