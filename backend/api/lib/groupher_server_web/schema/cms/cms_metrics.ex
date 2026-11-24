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

  @desc "Fields shared by posts, blog articles, changelogs and Docs."
  interface :article do
    # article 所包含的共同字段
    @desc "Stable article ID, independent of its community route."
    field(:id, non_null(:id),
      resolve: fn source, _, _ ->
        {:ok, Map.get(source, :article_id) || Map.get(source, :id)}
      end
    )

    @desc "Article number within the community."
    field(:inner_id, :id)
    @desc "Article headline."
    field(:title, :string)
    @desc "Current counts and their revisions."
    field(:article_stats, :article_stats)
    @desc "Thread and interaction metadata."
    field(:meta, :article_meta)
    @desc "Cover image URL."
    field(:cover_url, :string)
    @desc "Alternate cover image URL for dark mode."
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
    @desc "Match indexed articles."
    value(:article)
    @desc "Match indexed comments."
    value(:comment)
  end

  enum :search_artiment_sort do
    @desc "Rank matches by relevance to the search text."
    value(:relevance)
  end

  input_object :search_artiments_scope_input do
    @desc "Restrict the search to this community reference."
    field(:community_ref, :string)
    @desc "Restrict the search to this article and its indexed content."
    field(:article_id, :id)
  end

  input_object :search_artiments_filters_input do
    @desc "Content kinds to include."
    field(:types, list_of(non_null(:search_artiment_type)))
    @desc "Article threads to include."
    field(:threads, list_of(non_null(:thread)))
    @desc "Include content by these author references."
    field(:author_refs, list_of(non_null(:string)))
    @desc "Languages to include."
    field(:locales, list_of(non_null(:string)))
  end

  input_object :search_artiments_query_input do
    @desc "Text to match against the index."
    field(:text, non_null(:string))
    @desc "Community or article boundary for the search."
    field(:scope, :search_artiments_scope_input)
    @desc "Additional constraints on indexed content."
    field(:filters, :search_artiments_filters_input)
    @desc "How to rank matches."
    field(:sort, :search_artiment_sort, default_value: :relevance)
    @desc "Whether to return highlighted match fragments."
    field(:highlight, :boolean, default_value: true)
  end

  enum :content do
    article_values()
    @desc "A comment on an article."
    value(:comment)
  end

  enum :mention_type do
    article_values()
    @desc "A ticket referenced by the source."
    value(:ticket)
    @desc "A comment referenced by the source."
    value(:comment)
    @desc "An account referenced by login."
    value(:user)
    @desc "External URL mentions only; internal URLs are normalized to concrete content types."
    value(:url)
  end

  enum :mention_scope do
    @desc "Targets within Groupher."
    value(:internal)
    @desc "Targets outside Groupher."
    value(:external)
  end

  enum :mention_case do
    @desc "An explicit mention within the content."
    value(:inline_mention)
    @desc "A hyperlink recognized as a mention."
    value(:link)
  end

  enum :when_enum do
    @desc "Current calendar day."
    value(:today)
    @desc "Current calendar week."
    value(:this_week)
    @desc "Current calendar month."
    value(:this_month)
    @desc "Current calendar year."
    value(:this_year)
  end

  enum :account_sort_enum do
    @desc "Oldest accounts first."
    value(:asc_inserted)
    @desc "Newest accounts first."
    value(:desc_inserted)
  end

  enum :thread_sort_enum do
    @desc "Lowest configured position first."
    value(:asc_index)
    @desc "Highest configured position first."
    value(:desc_index)
    @desc "Oldest threads first."
    value(:asc_inserted)
    @desc "Newest threads first."
    value(:desc_inserted)
  end

  enum :length_enum do
    @desc "Longest content first by word count."
    value(:most_words)
    @desc "Shortest content first by word count."
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
    @desc "Group comments by conversation."
    value(:replies)
    @desc "Show comments in a single timeline."
    value(:timeline)
  end

  enum(:comment_page_sort_enum, do: enum_values(CMS.comments_query_sort_values_ast()))

  input_object :communities_filter do
    @desc "Ordering for the community list."
    field(:sort, :community_sort_enum)
    @desc "Restrict results by community category."
    field(:category, :string)
  end

  # for reindex usage
  input_object :reindex_tag_input do
    @desc "Tag to move."
    field(:id, :id)
    @desc "New position in the group."
    field(:index, :integer)
  end

  input_object :reindex_community_tag_input do
    @desc "Tag to move."
    field(:id, non_null(:id))
    @desc "Destination tag group."
    field(:group_id, non_null(:id))
    @desc "New position within the destination group."
    field(:index, non_null(:integer))
  end

  input_object :reindex_community_tag_group_input do
    @desc "Tag group to move."
    field(:id, non_null(:id))
    @desc "New position among the groups."
    field(:index, non_null(:integer))
  end

  input_object :article_path_input do
    @desc "Article number within the community."
    field(:inner_id, non_null(:id))
    @desc "Community slug in the article route."
    field(:community, non_null(:string))
    @desc "Article thread in the route."
    field(:thread, non_null(:thread))
  end

  input_object :comment_path_input do
    @desc "Path to the containing article."
    field(:article, non_null(:article_path_input))
    @desc "Comment number within the article."
    field(:inner_id, non_null(:id))
  end

  input_object :mention_source_input do
    @desc "Path of the article containing the mention."
    field(:article, :article_path_input)
    @desc "Path of the comment containing the mention."
    field(:comment, :comment_path_input)
    @desc "Path of the ticket containing the mention."
    field(:ticket, :ticket_path_input)
  end

  input_object :mention_target_input do
    @desc "Kind of referenced resource."
    field(:type, non_null(:mention_type))
    @desc "Locator for an internal content target."
    field(:locator, :mentions_graph_locator_input)
    @desc "Login of the mentioned account."
    field(:user_login, :string)
  end

  input_object :ticket_path_input do
    @desc "Community slug in the ticket route."
    field(:community, non_null(:string))
    @desc "Community ticket number."
    field(:inner_id, non_null(:id))
  end

  input_object :trash_filter do
    @desc "Restrict trash entries to one article thread."
    field(:thread, :thread)
  end

  input_object :community_activity_filter_input do
    @desc "Include these resource kinds."
    field(:resource_types, list_of(non_null(:string)))
    @desc "Include these recorded actions."
    field(:actions, list_of(non_null(:string)))
    @desc "Include these action categories."
    field(:categories, list_of(non_null(:string)))
    @desc "Include these operation outcomes."
    field(:outcomes, list_of(non_null(:string)))
    @desc "Include these rejection reasons."
    field(:rejection_codes, list_of(non_null(:string)))
    @desc "Include events from these kinds of actors."
    field(:actor_types, list_of(non_null(:string)))
    @desc "Reference of the actor who performed the action."
    field(:actor_ref, :id)
    @desc "Reference of the actor represented by the caller."
    field(:on_behalf_of_ref, :id)
    @desc "Reference of the subject of the event."
    field(:subject_ref, :id)
    @desc "Reference of the target of the action."
    field(:target_ref, :id)
    @desc "Match events that changed the specified fields."
    field(:changed_fields, list_of(non_null(:string)))
    @desc "Origin of the recorded action."
    field(:source, :string)
    @desc "Lower bound on event occurrence time."
    field(:occurred_after, :datetime)
    @desc "Upper bound on event occurrence time."
    field(:occurred_before, :datetime)
    @desc "Restrict events to a single operation."
    field(:operation_ref, :id)
  end

  input_object :community_activity_selection_input do
    @desc "Named activity preset to apply."
    field(:preset_key, :string)
    @desc "Additional constraints on the selected events."
    field(:filter, :community_activity_filter_input)
  end

  enum :community_activity_export_format do
    @desc "Export structured JSON."
    value(:json)
    @desc "Export comma-separated rows."
    value(:csv)
  end

  @desc "Offset page parameters for the new paged resource contract."
  input_object :offset_pagi_input do
    @desc "Requested page number, starting at one."
    field(:page, :integer)
    @desc "Maximum entries per page."
    field(:size, :integer)
    @desc "Pagination settings revision used by the client."
    field(:config_revision, :integer)
  end

  @desc "Forward cursor parameters for the new paged resource contract."
  input_object :forward_cursor_pagi_input do
    @desc "Maximum entries to return after the cursor."
    field(:first, :integer)
    @desc "Opaque cursor from the preceding page."
    field(:after, :string)
    @desc "Pagination settings revision used by the client."
    field(:config_revision, :integer)
  end

  @desc "Exactly one offset or forward-cursor pagination input."
  input_object :pagi_input do
    directive(:one_of)
    @desc "Select a numbered page."
    field(:offset, :offset_pagi_input)
    @desc "Continue forward from a cursor."
    field(:cursor, :forward_cursor_pagi_input)
  end

  input_object :article_page_filter do
    article_filter_fields()
    @desc "Ordering to apply to matching articles."
    field(:sort, :article_sort_enum)
  end

  input_object :post_filter do
    article_filter_fields()
    @desc "Ordering to apply to matching articles."
    field(:sort, :article_sort_enum)
  end

  input_object :changelog_filter do
    article_filter_fields()
    @desc "Ordering to apply to matching articles."
    field(:sort, :article_sort_enum)
  end

  input_object :comment_page_filter do
    @desc "Ordering to apply to matching comments."
    field(:sort, :comment_page_sort_enum)
  end

  @desc "Thread scope for an account's Article/folder collections."
  input_object :article_collection_filter do
    @desc "Restrict collected articles to this thread."
    field(:thread, :thread)
  end
end
