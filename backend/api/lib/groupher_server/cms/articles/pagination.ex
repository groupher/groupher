defmodule GroupherServer.CMS.Articles.Pagination do
  @moduledoc """
  Owns the Article list read model and its Pagi boundary.

      GraphQL / service filter
        -> Articles.Pagination
        -> scope + Lite projection + Pagi.Order
        -> one bounded SQL page + distinct binding count
        -> Articles.Response batch presentation

  The query returns binding identity and cursor fields in the same row as the
  Article projection. Pinned entries are a separate first-page collection;
  they are never folded into the live cursor sequence.
  """

  require GroupherServer.CMS.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Pagi, Repo}
  alias CMS.Articles.{ArticleLite, Query.Contract}
  alias CMS.Communities.Enable
  alias CMS.Dashboard.PagiMode
  alias CMS.ErrorCat

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBindingTag,
    ArticleLifecycle,
    Author,
    ArticlePublic,
    Community,
    CommunityTag,
    DocBranch,
    DocBranchState,
    DocTreeNode,
    DocLifecycle,
    DocPublic,
    KanbanState,
    PinnedArticle,
    PostState
  }

  alias Accounts.Model.User

  alias Helper.ORM
  alias Helper.ORM.Pagi.{Config, Order, Page}
  alias Pagi.Params

  @type filter :: %{optional(atom()) => term()}

  @doc """
  Runs the public Article list through the shared offset/cursor contract.

  The returned page contains only live, non-pinned entries. The optional
  `:pinned_entries` key is added by this resource adapter for the first offset
  page, so a caller can render pinned content without changing cursor identity.

  ## Examples

      GroupherServer.CMS.Articles.Pagination.page(:post, %{
        community: "groupher",
        page: 1,
        size: 20
      })

  """
  @spec page(atom(), filter(), Accounts.Model.User.t() | nil, keyword()) ::
          {:ok, map()} | {:error, term()}
  def page(thread, filter, pagi, viewer \\ nil, opts \\ [])

  def page(thread, filter, pagi, viewer, opts)
      when is_atom(thread) and is_map(filter) and is_list(opts) do
    with {:ok, :pass} <- Contract.validate_filter(filter),
         {:ok, effective} <- effective_pagination_config(thread, filter, pagi, opts),
         opts <- put_effective_config(opts, effective, filter),
         {:ok, _thread} <- Enable.thread?(Map.get(filter, :community), thread),
         {:ok, order} <- order_for(thread, filter),
         {:ok, params} <- Pagi.from_input(pagi, effective.config.default_size),
         {:ok, page} <- run_page(thread, filter, params, order, opts, viewer),
         {:ok, entries} <- present_entries(page.entries, viewer),
         {:ok, pinned_entries} <-
           present_pinned(thread, filter, viewer, params, order, opts) do
      {:ok,
       %{
         entries: entries,
         pinned_entries: pinned_entries,
         page_info: Page.info(page)
       }}
    end
  end

  def page(_thread, _filter, _pagi, _viewer, _opts) do
    {:error, ErrorCat.invalid_body("Invalid Article pagination input")}
  end

  defp effective_pagination_config(_thread, filter, pagi, opts) do
    case Keyword.fetch(opts, :config) do
      {:ok, %Config{} = config} ->
        {:ok, %{config: config, mode: nil, schema_version: nil}}

      {:ok, _config} ->
        {:error, Pagi.invalid_config()}

      :error ->
        PagiMode.for_community(Map.get(filter, :community),
          expected_revision: Pagi.revision(pagi)
        )
    end
  end

  defp put_effective_config(opts, effective, filter) do
    configured? = Keyword.has_key?(opts, :config) or is_binary(Map.get(filter, :community))
    opts = if configured?, do: Keyword.put(opts, :config, effective.config), else: opts

    opts
    |> Keyword.put(:mode, effective.mode)
    |> Keyword.put(:schema_version, effective.schema_version)
    |> Keyword.put(:resource, :articles)
  end

  @doc """
  Reads a bounded set of public ArticleLite rows by explicit Article paths.

  This is the batch side of the list contract for consumers such as published
  comment lists. It returns one row per requested binding path and never reads
  a public Article one item at a time.

  ## Examples

      GroupherServer.CMS.Articles.Pagination.lite_paths([
        %{community: "groupher", thread: :post, inner_id: 1}
      ])
  """
  @spec lite_paths([map()]) :: {:ok, [map()]} | {:error, term()}
  def lite_paths(paths) when is_list(paths) and length(paths) <= 100 do
    paths = Enum.uniq_by(paths, &{&1.community, &1.thread, &1.inner_id})

    case paths do
      [] ->
        {:ok, []}

      paths ->
        rows =
          paths
          |> Enum.group_by(& &1.thread)
          |> Enum.flat_map(fn {thread, thread_paths} ->
            thread
            |> public_path_query(thread_paths)
            |> Repo.all()
          end)

        {:ok, rows}
    end
  end

  def lite_paths(_paths) do
    {:error, ErrorCat.invalid_body("Too many ArticleLite paths")}
  end

  @doc "Returns the binding identities admitted by the canonical public Lite scope."
  def public_binding_ids(thread, actor \\ nil) do
    context =
      if thread == :doc do
        CMS.Gate.Context.Scope.Doc.public_main()
      else
        CMS.Gate.Context.Scope.Article.public(thread)
      end

    Article
    |> CMS.Gate.scope(actor, :list, context)
    |> exclude(:select)
    |> select([gate_article_binding: binding], binding.id)
  end

  @doc "Returns public binding identities across every Article thread."
  def public_binding_ids do
    queries =
      [:doc | CMS.Gate.Config.ordinary_article_threads()]
      |> Enum.map(&public_binding_ids/1)

    [query | rest] = queries
    Enum.reduce(rest, query, fn next, acc -> union_all(acc, ^next) end)
  end

  defp run_page(thread, filter, params, order, opts, viewer) do
    query_opts = [
      include_pinned: Keyword.get(opts, :include_pinned, false),
      public_tree: Keyword.get(opts, :public_tree, false)
    ]

    query = public_query(thread, filter, order, query_opts, viewer)
    count = count_query(thread, filter, query_opts, viewer)

    pagi_opts = [
      for: ArticleLite,
      order: order,
      cursor_value_func: &ArticleLite.cursor_values/2,
      surface: "articles.#{thread}",
      query_fingerprint: query_fingerprint(thread, filter, order, query_opts),
      count_query: fn -> count end,
      count_query_mode: :scalar
    ]

    pagi_opts =
      case Keyword.fetch(opts, :config) do
        {:ok, config} -> Keyword.put(pagi_opts, :config, config)
        :error -> pagi_opts
      end

    ORM.pagi(query, params, pagi_opts)
  end

  defp requested_order(filter) do
    Map.get(filter, :order) || Map.get(filter, :sort)
  end

  defp order_for(thread, filter) do
    {fields, directions, bindings} =
      case requested_order(filter) do
        :publish ->
          {[:published_at, :binding_id], [:desc_nulls_last, :desc], []}

        :upvotes ->
          stats_order(:upvotes_count, :desc_nulls_last)

        :comments ->
          stats_order(:comments_count, :desc_nulls_last)

        :views ->
          stats_order(:views, :desc_nulls_last)

        :most_views ->
          stats_order(:views, :desc_nulls_last)

        :least_views ->
          stats_order(:views, :asc_nulls_first)

        :asc_inserted ->
          simple_order(:inserted_at, :asc)

        :desc_inserted ->
          simple_order(:inserted_at, :desc)

        :asc_active ->
          simple_order(active_field(thread), :asc)

        :desc_active ->
          simple_order(active_field(thread), :desc)

        _ ->
          simple_order(active_field(thread), :desc)
      end

    Order.new(%{
      fields: fields,
      directions: directions,
      cursor_fields: fields,
      bindings: bindings,
      projection: fields
    })
  end

  defp simple_order(field, direction) do
    {[field, :binding_id], [direction, direction], []}
  end

  defp stats_order(field, direction) do
    {[field, :binding_id], [direction, :desc], [:article_stats]}
  end

  defp active_field(:doc), do: :doc_active_at
  defp active_field(_thread), do: :active_at

  defp public_query(thread, filter, order, opts, viewer) do
    thread
    |> public_scope(filter, opts, viewer)
    |> ArticleLite.select(order, thread)
  end

  defp public_scope(thread, filter, opts, viewer) do
    visible = public_binding_ids(thread, viewer)
    include_pinned = Keyword.get(opts, :include_pinned, false)

    from(article in Article,
      as: :article,
      join: binding in ArticleBinding,
      as: :article_binding,
      on: binding.article_id == article.id,
      join: community in Community,
      as: :article_community,
      on: community.id == binding.community_id,
      where: article.thread == ^thread and binding.id in subquery(visible)
    )
    |> add_public_joins(thread)
    |> maybe_add_public_tree(thread, opts)
    |> apply_filter(filter)
    |> maybe_exclude_pinned(include_pinned)
  end

  defp add_public_joins(query, :doc) do
    query
    |> join(:inner, [article_binding: binding], branch in DocBranch,
      as: :doc_branch,
      on: branch.community_id == binding.community_id and branch.type == :main
    )
    |> join(:inner, [article: article, doc_branch: branch], state in DocBranchState,
      as: :stable_doc_state,
      on: state.article_id == article.id and state.branch_id == branch.id
    )
    |> join(:inner, [article: article, doc_branch: branch], public in DocPublic,
      as: :stable_public,
      on: public.article_id == article.id and public.branch_id == branch.id
    )
    |> join(
      :inner,
      [article: article, doc_branch: branch],
      lifecycle in DocLifecycle,
      as: :doc_lifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == branch.id
    )
  end

  defp add_public_joins(query, _thread) do
    query
    |> join(:inner, [article: article], public in ArticlePublic,
      as: :stable_public,
      on: public.article_id == article.id
    )
    |> join(
      :inner,
      [article: article],
      lifecycle in ArticleLifecycle,
      as: :article_lifecycle,
      on: lifecycle.article_id == article.id
    )
  end

  defp maybe_add_public_tree(query, :doc, opts) do
    if Keyword.get(opts, :public_tree, false) do
      where(
        query,
        exists(
          from(node in DocTreeNode,
            where:
              node.community_id == parent_as(:article_community).id and
                node.branch_id == parent_as(:doc_branch).id and
                node.stage == ^CMS.Const.stage(:public) and node.type == :page and
                node.doc_id == parent_as(:article).id
          )
        )
      )
    else
      query
    end
  end

  defp maybe_add_public_tree(query, _thread, _opts), do: query

  defp apply_filter(query, filter) do
    Enum.reduce(filter, query, fn
      {:author_id, user_id}, query when is_integer(user_id) ->
        authors = from(author in Author, where: author.user_id == ^user_id, select: author.id)
        where(query, [article: article], article.author_id in subquery(authors))

      {:statuses, statuses}, query when is_list(statuses) ->
        query
        |> join(:inner, [article_binding: binding], state in KanbanState,
          as: :kanban_state,
          on: state.article_binding_id == binding.id
        )
        |> where([kanban_state: state], state.status in ^statuses)

      {:community, community_ref}, query when is_binary(community_ref) and community_ref != "" ->
        where(query, [article_community: community], community.slug == ^community_ref)

      {:community_tag, tag}, query when is_binary(tag) and tag != "" ->
        tag_filter(query, [tag])

      {:community_tags, tags}, query when is_list(tags) and tags != [] ->
        tag_filter(query, tags)

      {:when, window}, query when window in [:today, :this_week, :this_month, :this_year] ->
        Helper.QueryBuilder.filter_pack(query, %{when: window})

      {:cat, cat}, query when is_atom(cat) and not is_nil(cat) ->
        query
        |> join(:inner, [article: article], state in PostState,
          as: :post_state,
          on: state.article_id == article.id
        )
        |> where([post_state: state], state.cat == ^cat)

      {:status, status_value}, query when is_atom(status_value) and not is_nil(status_value) ->
        query
        |> join(:inner, [article_binding: binding], state in KanbanState,
          as: :kanban_state,
          on: state.article_binding_id == binding.id
        )
        |> where([kanban_state: state], state.status == ^status_value)

      {_key, _value}, query ->
        query
    end)
  end

  defp tag_filter(query, tags) do
    where(
      query,
      exists(
        from(assignment in ArticleBindingTag,
          join: tag in CommunityTag,
          on: tag.id == assignment.tag_id,
          where:
            assignment.article_binding_id == parent_as(:article_binding).id and
              tag.slug in ^tags
        )
      )
    )
  end

  defp maybe_exclude_pinned(query, true), do: query

  defp maybe_exclude_pinned(query, false) do
    where(
      query,
      [article_binding: binding],
      not exists(
        from(pin in PinnedArticle,
          where: pin.article_binding_id == parent_as(:article_binding).id
        )
      )
    )
  end

  defp count_query(thread, filter, opts, viewer) do
    public_scope(thread, filter, opts, viewer)
    |> exclude(:distinct)
    |> select([article_binding: binding], count(binding.id, :distinct))
  end

  defp present_entries(entries, viewer) do
    entries
    |> present_lite_entries()
    |> then(fn entries -> maybe_attach_viewer(entries, viewer) end)
  end

  defp present_pinned(thread, filter, viewer, params, order, opts) do
    if Keyword.get(opts, :include_pinned, false) do
      {:ok, []}
    else
      page_pins(thread, filter, viewer, params, order, opts)
    end
  end

  defp page_pins(thread, filter, viewer, nil, order, opts) do
    load_pinned(thread, filter, viewer, order, opts)
  end

  defp page_pins(_thread, _filter, _viewer, %Params.Offset{page: page}, _order, _opts)
       when page != 1 do
    {:ok, []}
  end

  defp page_pins(thread, filter, viewer, %Params.Offset{}, order, opts) do
    load_pinned(thread, filter, viewer, order, opts)
  end

  defp page_pins(thread, filter, viewer, %Params.Cursor{after: nil}, order, opts) do
    load_pinned(thread, filter, viewer, order, opts)
  end

  defp page_pins(_thread, _filter, _viewer, %Params.Cursor{}, _order, _opts), do: {:ok, []}

  defp load_pinned(thread, filter, viewer, order, opts) do
    content_order = %{order | bindings: [], projection: []}

    pinned_query =
      public_query(
        thread,
        filter,
        content_order,
        [include_pinned: true, public_tree: Keyword.get(opts, :public_tree, false)],
        viewer
      )

    pinned_query
    |> where(
      [article_binding: binding],
      exists(
        from(pin in PinnedArticle,
          where: pin.article_binding_id == parent_as(:article_binding).id
        )
      )
    )
    |> order_by([article_binding: binding], asc: binding.id)
    |> Repo.all()
    |> Enum.map(&Map.put(&1, :is_pinned, true))
    |> present_lite_entries()
    |> then(fn entries -> maybe_attach_viewer(entries, viewer) end)
  end

  defp present_lite_entries([]), do: []

  defp present_lite_entries(rows) do
    Enum.map(rows, fn row ->
      %{
        id: row.article.id,
        thread: row.article.thread,
        inner_id: row.inner_id,
        title: row.title,
        cat: Map.get(row, :cat),
        status: Map.get(row, :status),
        is_pinned: Map.get(row, :is_pinned, false),
        digest: row.digest,
        author: row.author,
        community: row.community,
        community_tags: ArticleLite.community_tags(row.community_tags, row.community),
        active_at: row.active_at,
        inserted_at: row.article.inserted_at
      }
    end)
  end

  defp maybe_attach_viewer(entries, _viewer), do: {:ok, entries}

  defp query_fingerprint(thread, filter, order, opts) do
    query_filter = Map.put(filter, :order, Order.identity(order))

    :crypto.hash(
      :sha256,
      :erlang.term_to_binary(
        {thread, query_filter, Order.identity(order), Keyword.get(opts, :public_tree, false),
         Keyword.get(opts, :include_pinned, false)}
      )
    )
    |> Base.encode16(case: :lower)
  end

  defp public_path_query(thread, paths) do
    path_filter =
      if paths == :all do
        dynamic(true)
      else
        Enum.reduce(paths, dynamic(false), fn path, acc ->
          dynamic(
            [lite_article: article, lite_binding: binding, lite_community: community],
            ^acc or (community.slug == ^path.community and binding.inner_id == ^path.inner_id)
          )
        end)
      end

    visible_bindings = public_binding_ids(thread)

    from(article in Article,
      as: :lite_article,
      join: binding in ArticleBinding,
      as: :lite_binding,
      on: binding.article_id == article.id and binding.inner_id > 0,
      join: community in Community,
      as: :lite_community,
      on: community.id == binding.community_id,
      join: author in Author,
      on: author.id == article.author_id,
      join: user in User,
      on: user.id == author.user_id,
      left_join: public in ArticlePublic,
      on: public.article_id == article.id,
      left_join: lifecycle in ArticleLifecycle,
      on:
        lifecycle.article_id == article.id and
          lifecycle.state in [:published, :archived],
      left_join: branch in DocBranch,
      on: branch.community_id == binding.community_id and branch.type == :main,
      left_join: doc_state in DocBranchState,
      on: doc_state.article_id == article.id and doc_state.branch_id == branch.id,
      left_join: doc_public in DocPublic,
      on:
        doc_public.article_id == article.id and doc_public.branch_id == branch.id and
          doc_public.visible == true,
      left_join: doc_lifecycle in DocLifecycle,
      on:
        doc_lifecycle.article_id == article.id and doc_lifecycle.branch_id == branch.id and
          doc_lifecycle.state in [:published, :archived],
      where: ^path_filter,
      where: article.thread == ^thread,
      where: binding.id in subquery(visible_bindings),
      select: %{
        id: article.id,
        community_id: community.id,
        binding_id: binding.id,
        thread: article.thread,
        inner_id: binding.inner_id,
        title: fragment("COALESCE(?, ?)", public.title, doc_public.title),
        digest: fragment("COALESCE(?, ?)", public.digest, doc_public.digest),
        active_at: fragment("COALESCE(?, ?)", public.active_at, doc_public.active_at),
        published_at: fragment("COALESCE(?, ?)", public.published_at, doc_public.published_at),
        inserted_at: article.inserted_at,
        updated_at: article.updated_at,
        author: user,
        community: community
      }
    )
  end
end
