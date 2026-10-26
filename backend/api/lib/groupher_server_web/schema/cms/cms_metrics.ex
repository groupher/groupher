defmodule GroupherServerWeb.Schema.CMS.Metrics do
  @moduledoc """
  Shared CMS metric field groups for artiment and community GraphQL objects.

  Business position:

      Client
        -> Absinthe schema / Metrics
        -> resolver or domain context
        -> GraphQL response
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields
  import Helper.Utils, only: [module_to_atom: 1]

  alias GroupherServer.CMS
  require CMS

  @doc """
  only used for reaction result, like: upvote/collect/watch ...
  """
  interface :article do
    # article 所包含的共同字段
    field(:inner_id, :id)
    field(:title, :string)
    field(:article_stats, :article_stats)
    field(:meta, :article_meta)
    field(:cover_url, :string)
    field(:cover_url_dark, :string)

    # 这里只是遵循 absinthe 的规范，并不是指返回以下的字段
    resolve_type(fn
      %{thread: thread}, _ when thread in [:post, :blog, :changelog, :doc] -> thread
      %{meta: %{thread: thread}}, _ when thread in [:post, :blog, :changelog, :doc] -> thread
      parent_module, _ -> module_to_atom(parent_module)
    end)
  end

  thread_enums()

  @desc "emotion options of article"
  enum(:article_emotion, do: emotion_values())

  @desc "emotion options of comment"
  enum(:comment_emotion, do: emotion_values(:comment))

  @desc "emotion options used by API output"
  enum(:emotion_type, do: emotion_values(:all))

  enum :thread do
    enum_values(CMS.artiment_threads_values())
  end

  enum :search_artiment_type do
    value(:article)
    value(:comment)
  end

  enum :search_artiment_sort do
    value(:relevance)
  end

  input_object :search_artiments_scope_input do
    field(:community_ref, :string)
    field(:article_id, :id)
  end

  input_object :search_artiments_filters_input do
    field(:types, list_of(non_null(:search_artiment_type)))
    field(:threads, list_of(non_null(:thread)))
    field(:author_refs, list_of(non_null(:string)))
    field(:locales, list_of(non_null(:string)))
  end

  input_object :search_artiments_query_input do
    field(:text, non_null(:string))
    field(:scope, :search_artiments_scope_input)
    field(:filters, :search_artiments_filters_input)
    field(:sort, :search_artiment_sort, default_value: :relevance)
    field(:highlight, :boolean, default_value: true)
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

  enum :account_sort_enum do
    value(:asc_inserted)
    value(:desc_inserted)
  end

  enum :thread_sort_enum do
    value(:asc_index)
    value(:desc_index)
    value(:asc_inserted)
    value(:desc_inserted)
  end

  enum :length_enum do
    value(:most_words)
    value(:least_words)
  end

  enum(:article_order_enum, do: enum_values(CMS.articles_query_order_values_ast()))
  enum(:article_sort_enum, do: enum_values(CMS.articles_query_sort_values_ast()))
  enum(:community_sort_enum, do: enum_values(CMS.communities_query_sort_values_ast()))

  enum(:article_cat_enum, do: enum_values(CMS.artiment_const_cat_values_ast()))
  enum(:article_status_enum, do: enum_values(CMS.artiment_const_status_values_ast()))

  import_types(GroupherServerWeb.Schema.CMS.Dashboard.Metrics)

  @desc "the filter mode for list comments"
  enum :comments_mode do
    value(:replies)
    value(:timeline)
  end

  enum(:comment_page_sort_enum, do: enum_values(CMS.comments_query_sort_values_ast()))

  input_object :communities_filter do
    field(:sort, :community_sort_enum)
    field(:category, :string)
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

  input_object :article_path_input do
    field(:inner_id, non_null(:id))
    field(:community, non_null(:string))
    field(:thread, non_null(:thread))
  end

  input_object :comment_path_input do
    field(:article, non_null(:article_path_input))
    field(:inner_id, non_null(:id))
  end

  input_object :mention_source_input do
    field(:article, :article_path_input)
    field(:comment, :comment_path_input)
  end

  input_object :mention_target_input do
    field(:article, :article_path_input)
    field(:comment, :comment_path_input)
    field(:user_login, :string)
  end

  input_object :trash_filter do
    field(:thread, :thread)
  end

  input_object :community_activity_filter_input do
    field(:resource_types, list_of(non_null(:string)))
    field(:actions, list_of(non_null(:string)))
    field(:categories, list_of(non_null(:string)))
    field(:outcomes, list_of(non_null(:string)))
    field(:rejection_codes, list_of(non_null(:string)))
    field(:actor_types, list_of(non_null(:string)))
    field(:actor_ref, :id)
    field(:on_behalf_of_ref, :id)
    field(:subject_ref, :id)
    field(:target_ref, :id)
    field(:changed_fields, list_of(non_null(:string)))
    field(:source, :string)
    field(:occurred_after, :datetime)
    field(:occurred_before, :datetime)
    field(:operation_ref, :id)
  end

  input_object :community_activity_selection_input do
    field(:preset_key, :string)
    field(:filter, :community_activity_filter_input)
  end

  enum :community_activity_export_format do
    value(:json)
    value(:csv)
  end

  @desc "Offset page parameters for the new paged resource contract."
  input_object :offset_pagi_input do
    field(:page, :integer)
    field(:size, :integer)
    field(:config_revision, :integer)
  end

  @desc "Forward cursor parameters for the new paged resource contract."
  input_object :forward_cursor_pagi_input do
    field(:first, :integer)
    field(:after, :string)
    field(:config_revision, :integer)
  end

  @desc "Exactly one offset or forward-cursor pagination input."
  input_object :pagi_input do
    directive(:one_of)
    field(:offset, :offset_pagi_input)
    field(:cursor, :forward_cursor_pagi_input)
  end

  input_object :article_page_filter do
    article_filter_fields()
    field(:sort, :article_sort_enum)
  end

  input_object :post_filter do
    article_filter_fields()
    field(:sort, :article_sort_enum)
  end

  input_object :changelog_filter do
    article_filter_fields()
    field(:sort, :article_sort_enum)
  end

  input_object :comment_page_filter do
    field(:sort, :comment_page_sort_enum)
  end

  @desc "Thread scope for an account's Article/folder collections."
  input_object :article_collection_filter do
    field(:thread, :thread)
  end
end
