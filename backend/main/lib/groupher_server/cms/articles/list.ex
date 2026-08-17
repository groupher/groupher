defmodule GroupherServer.CMS.Articles.List do
  @moduledoc """
  Article listing helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> List
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps

  import Helper.Utils,
    only: [
      done: 1,
      pick_by: 2,
      module_to_atom: 1
    ]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Gate.{Allow, Scope}
  alias CMS.Dashboard.KanbanBoards
  alias CMS.Interactions.State
  alias CMS.Artiment.Enums
  alias CMS.Model.{Community, Embeds, PinnedArticle, Post, TrashedArticle, TrashedDocArticle}
  alias Helper.{ORM, QueryBuilder, T}

  require CMS.Const

  @article_status Enums.status_values() |> Enum.into(%{}, &{&1, &1})
  @kanban_rejected_statuses [
    @article_status.reject,
    @article_status.reject_dup,
    @article_status.reject_no_plan,
    @article_status.reject_repro,
    @article_status.reject_stale
  ]

  @doc """
  Returns a paged list of legal articles for one thread.

  Applies the public article scope, filter pack, and optional interaction
  ordering, then prepends pinned articles on the first page.

  ## Examples

      CMS.Articles.List.page(:post, %{page: 1, size: 20})

  """
  @spec page(atom(), map()) :: T.domain_res(term())
  def page(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{pending: :legal}

    with {:ok, _thread} <- Allow.thread(Map.get(filter, :community), thread),
         {:ok, info} <- match(thread) do
      info.model
      |> Scope.scope(nil, :list, scope_context(thread))
      |> QueryBuilder.domain_query(filter)
      |> QueryBuilder.filter_pack(filter_for_interaction_order(Map.merge(filter, flags)))
      |> State.order_articles(thread, Map.get(filter, :order))
      |> ORM.paginator(~m(page size)a)
      |> add_pin_articles_ifneed(info.model, filter)
      |> read_articles(thread, nil)
      |> normalize_article_entries(thread)
      |> done()
    end
  end

  @spec page(atom(), map(), User.t()) :: T.domain_res(term())
  def page(thread, filter, %User{} = user) do
    with {:ok, stateless_paged_articles} <- page(thread, filter) do
      stateless_paged_articles
      |> read_articles(thread, user)
      |> done()
    end
  end

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community) do
    filter = %{page: 1, size: 20}
    enabled_boards = enabled_kanban_boards(community)

    KanbanBoards.values_list()
    |> Enum.reduce_while({:ok, %{}}, fn board, {:ok, acc} ->
      # `reduce_while/3` uses `{:cont, acc}` to continue and `{:halt, acc}` to stop early.
      # We keep collecting board payloads on success, but short-circuit immediately on errors.
      case paged_kanban_for_board(community, board, filter, enabled_boards) do
        {:ok, paged_posts} -> {:cont, {:ok, Map.put(acc, board, paged_posts)}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp enabled_kanban_boards(%Community{} = community) do
    community
    |> Repo.preload(:dashboard, force: true)
    |> get_in([Access.key(:dashboard), Access.key(:layout), Access.key(:kanban_boards)])
    |> case do
      boards when is_list(boards) and boards != [] -> boards
      _ -> KanbanBoards.default_values_list()
    end
  end

  defp paged_kanban_for_board(
         %Community{} = community,
         board,
         filter,
         enabled_boards
       ) do
    if board in enabled_boards do
      paged_kanban(community, Map.put(filter, :status, kanban_board_status(board)))
    else
      {:ok, empty_paged_kanban(filter)}
    end
  end

  defp kanban_board_status(:backlog), do: @article_status.backlog
  defp kanban_board_status(:todo), do: @article_status.todo
  defp kanban_board_status(:wip), do: @article_status.wip
  defp kanban_board_status(:done), do: @article_status.done
  # rejected is a virtual kanban column that aggregates all reject states.
  defp kanban_board_status(:rejected), do: @kanban_rejected_statuses

  defp empty_paged_kanban(%{page: page, size: size}) do
    %{entries: [], total_count: 0, page_number: page, page_size: size, total_pages: 0}
  end

  def paged_kanban(%Community{} = community, %{status: statuses} = filter)
      when is_list(statuses) do
    %{page: page, size: size} = filter

    valid_statuses =
      statuses
      |> Enum.filter(&is_atom/1)
      |> Enum.filter(&(&1 in Map.keys(@article_status)))

    case valid_statuses do
      [] ->
        %{entries: [], total_count: 0, page_number: page, page_size: size, total_pages: 0}
        |> done()

      _ ->
        flags = %{pending: :legal, community_id: community.id, status: nil}

        Post
        |> CMS.Articles.Trash.not_trashed_scope(:post)
        |> QueryBuilder.filter_pack(Map.merge(filter, flags))
        |> where([p], p.status in ^valid_statuses)
        |> ORM.paginator(~m(page size)a)
        |> done()
    end
  end

  def paged_kanban(%Community{} = community, filter) do
    %{page: page, size: size, status: status} = filter

    flags = %{pending: :legal, community_id: community.id, status: status}

    Post
    |> CMS.Articles.Trash.not_trashed_scope(:post)
    |> QueryBuilder.filter_pack(Map.merge(filter, flags))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @spec paged_published(atom(), map(), User.t(), User.t() | nil) :: T.domain_res(term())
  def paged_published(thread, filter, %User{} = target_user, actor) do
    %{page: page, size: size} = filter

    with {:ok, info} <- match(thread) do
      info.model
      |> Scope.scope(actor, :list, scope_context(thread))
      |> join(:inner, [article, ...], author in assoc(article, :author), as: :published_author)
      |> where([_article, ...], as(:published_author).user_id == ^target_user.id)
      |> select([article, ...], article)
      |> QueryBuilder.filter_pack(filter_for_interaction_order(filter))
      |> State.order_articles(thread, Map.get(filter, :order))
      |> ORM.paginator(~m(page size)a)
      |> maybe_mark_viewer_states(thread, actor)
      |> done()
    end
  end

  @spec count_published(atom(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user) do
    with {:ok, info} <- match(thread) do
      info.model
      |> Scope.scope(nil, :list, scope_context(thread))
      |> join(:inner, [article, ...], author in assoc(article, :author), as: :published_author)
      |> where([_article, ...], as(:published_author).user_id == ^user.id)
      |> select([article, ...], count(article.id))
      |> Repo.one()
      |> done()
    end
  end

  defp maybe_mark_viewer_states(paged_articles, thread, %User{} = actor) do
    read_articles(paged_articles, thread, actor)
  end

  defp maybe_mark_viewer_states(paged_articles, _thread, _actor), do: paged_articles

  defp scope_context(:doc), do: %{thread: :doc, branch_policy: :main, policy_mode: :public}
  defp scope_context(thread), do: %{thread: thread, policy_mode: :public}

  defp read_articles(%{entries: entries} = paged_articles, thread, actor) do
    Map.put(paged_articles, :entries, State.read(thread, entries, actor, []))
  end

  defp add_pin_articles_ifneed(articles, queryable, %{community: community} = filter) do
    thread = module_to_atom(queryable)

    with true <- should_add_pin?(filter),
         true <- 1 == Map.get(articles, :page_number),
         {:ok, pinned_articles} <-
           PinnedArticle
           |> join(:inner, [p], c in assoc(p, :community))
           |> join(:inner, [p], article in assoc(p, ^thread))
           |> pin_trash_join(thread)
           |> where([p, c, article, trashed], c.slug == ^community and is_nil(trashed.id))
           |> select([p, c, article, trashed], article)
           |> ORM.find_all(%{page: 1, size: 10}) do
      concat_articles(pinned_articles, articles)
    else
      _error -> articles
    end
  end

  defp add_pin_articles_ifneed(articles, _queryable, _filter), do: articles

  defp pin_trash_join(query, :doc) do
    join(query, :left, [p, c, article], trashed in TrashedDocArticle,
      on:
        trashed.community_id == article.community_id and
          trashed.branch_id == article.branch_id and
          trashed.article_hash_id == article.article_hash_id
    )
  end

  defp pin_trash_join(query, thread) do
    join(query, :left, [p, c, article], trashed in TrashedArticle,
      on:
        trashed.thread == ^thread and
          trashed.article_hash_id == article.article_hash_id
    )
  end

  defp should_add_pin?(%{page: 1, sort: :desc_active} = filter) do
    skip_pinned_fields = [:article_tag, :article_tags, :community_tag, :community_tags, :order]

    not Enum.any?(Map.keys(filter), &(&1 in skip_pinned_fields))
  end

  defp should_add_pin?(_filter), do: false

  defp filter_for_interaction_order(%{order: order} = filter) when order in [:upvotes, :collects],
    do: Map.drop(filter, [:order, :sort])

  defp filter_for_interaction_order(filter), do: filter

  defp concat_articles(%{total_count: 0}, non_pinned_articles), do: non_pinned_articles

  defp concat_articles(pinned_articles, non_pinned_articles) do
    pinned_entries =
      pinned_articles
      |> Map.get(:entries)
      |> Enum.map(&struct(&1, %{is_pinned: true}))

    normal_entries = non_pinned_articles |> Map.get(:entries)
    normal_count = non_pinned_articles |> Map.get(:total_count)

    pinned_ids = pick_by(pinned_entries, :id)
    normal_entries = Enum.reject(normal_entries, &(&1.id in pinned_ids))

    non_pinned_articles
    |> Map.put(:entries, pinned_entries ++ normal_entries)
    |> Map.put(:total_count, normal_count)
  end

  defp normalize_article_entries(%{entries: entries} = articles, thread) do
    entries =
      entries
      |> Enum.map(&normalize_article_entry(&1, thread))

    Map.put(articles, :entries, entries)
  end

  defp normalize_article_entries(articles, _thread), do: articles

  defp normalize_article_entry(article, thread) do
    article
    |> ensure_article_meta(thread)
    |> ensure_active_at()
  end

  defp ensure_article_meta(%{meta: nil} = article, thread) do
    meta = Embeds.ArticleMeta.default_meta() |> Map.merge(%{thread: thread})
    Map.put(article, :meta, meta)
  end

  defp ensure_article_meta(%{meta: %{thread: nil} = meta} = article, thread) do
    Map.put(article, :meta, Map.put(meta, :thread, thread))
  end

  defp ensure_article_meta(article, _thread), do: article

  defp ensure_active_at(%{active_at: nil, inserted_at: inserted_at} = article)
       when not is_nil(inserted_at) do
    Map.put(article, :active_at, inserted_at)
  end

  defp ensure_active_at(article), do: article
end
