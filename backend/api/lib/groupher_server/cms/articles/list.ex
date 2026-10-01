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

  import Helper.Utils,
    only: [
      done: 1
    ]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.Response
  alias CMS.Artiment.Const
  alias CMS.Communities.Enable
  alias CMS.Dashboard.KanbanBoards
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.Scope

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleCommunityTag,
    ArticleLifecycle,
    ArticlePublic,
    ArticleStats,
    Community,
    CommunityTag,
    DocBranch,
    DocBranchState,
    DocLifecycle,
    DocPublic,
    PinnedArticle,
    PostState
  }

  alias Helper.T

  @article_status Const.status_values() |> Enum.into(%{}, &{&1, &1})
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
  def page(thread, filter), do: do_page(thread, filter, nil)

  @spec page(atom(), map(), User.t()) :: T.domain_res(term())
  def page(thread, filter, %User{} = user), do: do_page(thread, filter, user)

  defp do_page(thread, filter, viewer) do
    %{page: page, size: size} = filter

    with {:ok, _thread} <- Enable.thread?(Map.get(filter, :community), thread) do
      stable_page(thread, filter, viewer, page, size)
    end
  end

  defp stable_page(thread, filter, _viewer, page, size) do
    community_ref = Map.get(filter, :community)

    base =
      from(article in Article,
        join: relation in ArticleCommunity,
        on: relation.article_id == article.id and relation.visible == true,
        join: community in Community,
        on: community.id == relation.community_id,
        where:
          article.thread == ^thread and article.inner_id > 0 and
            article.moderation_state == :legal,
        select: %{inner_id: article.inner_id, community: community.slug}
      )

    base =
      if is_binary(community_ref),
        do: where(base, [_article, _relation, community], community.slug == ^community_ref),
        else: where(base, [_article, relation, _community], relation.role == :home)

    base =
      base
      |> stable_public_join(thread)
      |> stable_filter(filter)
      |> stable_order(filter, thread)
      |> stable_pin_order(page, community_ref)

    total_count =
      base
      |> exclude(:order_by)
      |> exclude(:select)
      |> exclude(:distinct)
      |> select([article, ...], count(article.id, :distinct))
      |> Repo.one()

    entries =
      base
      |> offset(^((page - 1) * size))
      |> limit(^size)
      |> Repo.all()
      |> Enum.flat_map(fn path ->
        case CMS.FrontDesk.article(%{
               community: path.community,
               thread: thread,
               inner_id: path.inner_id
             }) do
          {:ok, article} -> [article]
          {:error, _reason} -> []
        end
      end)

    {:ok, entries} = Response.list(entries, nil)

    {:ok,
     %{
       entries: entries,
       total_count: total_count,
       page_number: page,
       page_size: size,
       total_pages: if(total_count == 0, do: 0, else: ceil(total_count / size))
     }}
  end

  defp stable_filter(query, filter) do
    Enum.reduce(filter, query, fn
      {:community_tag, tag}, query when is_binary(tag) and tag != "" ->
        stable_tag_filter(query, [tag])

      {:community_tags, tags}, query when is_list(tags) and tags != [] ->
        stable_tag_filter(query, tags)

      {:when, window}, query when window in [:today, :this_week, :this_month, :this_year] ->
        Helper.QueryBuilder.filter_pack(query, %{when: window})

      {:cat, cat}, query when is_atom(cat) ->
        stable_post_state_filter(query, :cat, cat)

      {:status, status}, query when is_atom(status) ->
        stable_post_state_filter(query, :status, status)

      _, query ->
        query
    end)
  end

  defp stable_post_state_filter(query, field, value) do
    query
    |> join(:inner, [article, ...], state in PostState, on: state.article_id == article.id)
    |> where([_article, ..., state], field(state, ^field) == ^value)
  end

  defp stable_tag_filter(query, tags) do
    from([article, relation, _community, ...] in query,
      join: assignment in ArticleCommunityTag,
      on: assignment.article_community_id == relation.id,
      join: tag in CommunityTag,
      on: tag.id == assignment.tag_id and tag.slug in ^tags,
      distinct: article.id
    )
  end

  defp stable_order(query, filter, thread) do
    query = exclude(query, :order_by)

    case {Map.get(filter, :order), Map.get(filter, :sort)} do
      {:upvotes, _} ->
        stable_stats_order(query, :upvotes_count, :desc)

      {:comments, _} ->
        stable_stats_order(query, :comments_count, :desc)

      {:views, _} ->
        stable_stats_order(query, :views, :desc)

      {_, :most_views} ->
        stable_stats_order(query, :views, :desc)

      {_, :least_views} ->
        stable_stats_order(query, :views, :asc)

      {:publish, _} ->
        order_by(query, [article, ...],
          desc: as(:stable_public).published_at,
          desc: article.inserted_at,
          desc: article.inner_id,
          desc: article.id
        )

      {_, :asc_active} ->
        stable_active_order(query, thread, :asc)

      {_, :asc_inserted} ->
        order_by(query, [article, ...], asc: article.inserted_at)

      {_, :desc_inserted} ->
        order_by(query, [article, ...], desc: article.inserted_at)

      _ ->
        stable_active_order(query, thread, :desc)
    end
  end

  defp stable_pin_order(query, 1, community_ref) when is_binary(community_ref) do
    query
    |> join(:left, [_article, relation, ...], pin in PinnedArticle,
      on: pin.article_community_id == relation.id
    )
    |> prepend_order_by([_article, _relation, ..., pin], desc_nulls_last: pin.id)
  end

  defp stable_pin_order(query, _page, _community_ref), do: query

  defp stable_active_order(query, :doc, direction) do
    order_by(query, [article, ...], [
      {^direction, as(:stable_doc_state).active_at},
      {^direction, article.inserted_at}
    ])
  end

  defp stable_active_order(query, _thread, direction) do
    order_by(query, [article, ...], [
      {^direction, article.active_at},
      {^direction, article.inserted_at}
    ])
  end

  defp stable_stats_order(query, field, direction) do
    query
    |> join(:left, [article, ...], stats in ArticleStats,
      on: stats.article_id == article.id and stats.thread == article.thread
    )
    |> order_by([article, ..., stats], [
      {^direction, field(stats, ^field)},
      desc: article.active_at,
      desc: article.inserted_at
    ])
  end

  defp stable_public_join(query, :doc) do
    query
    |> join(:inner, [article, _relation, _community], branch in DocBranch,
      on: branch.community_id == article.community_id and branch.type == :main
    )
    |> join(:inner, [article, _relation, _community, branch], state in DocBranchState,
      as: :stable_doc_state,
      on: state.article_id == article.id and state.branch_id == branch.id
    )
    |> join(:inner, [article, _relation, _community, branch, _state], public in DocPublic,
      as: :stable_public,
      on:
        public.article_id == article.id and public.branch_id == branch.id and
          public.visible == true
    )
    |> join(
      :inner,
      [article, _relation, _community, branch, _state, _public],
      lifecycle in DocLifecycle,
      on:
        lifecycle.article_id == article.id and lifecycle.branch_id == branch.id and
          lifecycle.state in [:published, :archived]
    )
  end

  defp stable_public_join(query, _thread) do
    query
    |> join(:inner, [article, _relation, _community], public in ArticlePublic,
      as: :stable_public,
      on: public.article_id == article.id and public.visible == true
    )
    |> join(:inner, [article, _relation, _community, _public], lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.state in [:published, :archived]
    )
  end

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community) do
    filter = %{page: 1, size: 20}
    enabled_boards = enabled_kanban_boards(community)

    grouped =
      KanbanBoards.values_list()
      |> Map.new(fn board ->
        {:ok, paged_posts} = paged_kanban_for_board(community, board, filter, enabled_boards)
        {board, paged_posts}
      end)

    {:ok, grouped}
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

    valid_statuses = Enum.filter(statuses, &(is_atom(&1) and &1 in Map.keys(@article_status)))

    case valid_statuses do
      [] ->
        %{entries: [], total_count: 0, page_number: page, page_size: size, total_pages: 0}
        |> done()

      _ ->
        stable_paged_kanban(community, valid_statuses, page, size)
    end
  end

  def paged_kanban(%Community{} = community, filter) do
    %{page: page, size: size, status: status} = filter

    stable_paged_kanban(community, [status], page, size)
  end

  defp stable_paged_kanban(community, statuses, page, size) do
    base =
      from(article in Article,
        join: relation in ArticleCommunity,
        on: relation.article_id == article.id,
        join: state in PostState,
        on: state.article_id == article.id,
        join: public in ArticlePublic,
        on: public.article_id == article.id and public.visible == true,
        join: lifecycle in ArticleLifecycle,
        on: lifecycle.article_id == article.id,
        where:
          article.thread == :post and article.moderation_state == :legal and
            relation.community_id == ^community.id and relation.visible == true and
            lifecycle.state in [:published, :archived] and state.status in ^statuses,
        order_by: [desc: public.published_at],
        select: article.inner_id
      )

    total_count = Repo.aggregate(exclude(base, :order_by), :count)

    entries =
      base
      |> offset(^((page - 1) * size))
      |> limit(^size)
      |> Repo.all()
      |> Enum.map(fn inner_id ->
        {:ok, article} =
          CMS.FrontDesk.article(%{
            community: community.slug,
            thread: :post,
            inner_id: inner_id
          })

        article
      end)

    {:ok,
     %{
       entries: entries,
       total_count: total_count,
       page_number: page,
       page_size: size,
       total_pages: if(total_count == 0, do: 0, else: ceil(total_count / size))
     }}
  end

  @spec paged_published(atom(), map(), User.t(), User.t() | nil) :: T.domain_res(term())
  def paged_published(thread, filter, %User{} = target_user, actor) do
    %{page: page, size: size} = filter

    with %Ecto.Query{} = query <- Scope.scope(Article, actor, :list, scope_context(thread)) do
      query =
        query
        |> join(:inner, [article, ...], author in assoc(article, :author), as: :published_author)
        |> join(:inner, [article, ...], community in assoc(article, :community),
          as: :published_community
        )
        |> where([_article, ...], as(:published_author).user_id == ^target_user.id)
        |> order_by([article, ...], desc: article.active_at, desc: article.inserted_at)
        |> select([article, ...], %{
          inner_id: article.inner_id,
          community: as(:published_community).slug
        })

      total_count = query |> exclude(:order_by) |> exclude(:select) |> Repo.aggregate(:count)

      entries =
        query
        |> offset(^((page - 1) * size))
        |> limit(^size)
        |> Repo.all()
        |> Enum.flat_map(&load_public_path(&1, thread))

      %{
        entries: entries,
        total_count: total_count,
        page_number: page,
        page_size: size,
        total_pages: if(total_count == 0, do: 0, else: ceil(total_count / size))
      }
      |> maybe_mark_viewer_states(thread, actor)
      |> done()
    end
  end

  @spec count_published(atom(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user) do
    with %Ecto.Query{} = query <- Scope.scope(Article, nil, :list, scope_context(thread)) do
      query
      |> join(:inner, [article, ...], author in assoc(article, :author), as: :published_author)
      |> where([_article, ...], as(:published_author).user_id == ^user.id)
      |> select([article, ...], count(article.id))
      |> Repo.one()
      |> done()
    end
  end

  defp maybe_mark_viewer_states(paged_articles, _thread, %User{} = actor) do
    read_articles(paged_articles, actor)
  end

  defp maybe_mark_viewer_states(paged_articles, _thread, nil),
    do: read_articles(paged_articles, nil)

  defp scope_context(:doc), do: DocContext.public_main()
  defp scope_context(thread), do: ArticleContext.public(thread)

  defp read_articles(%{entries: entries} = paged_articles, actor) do
    case Response.list(entries, actor) do
      {:ok, entries} -> Map.put(paged_articles, :entries, entries)
      {:error, _reason} = error -> error
    end
  end

  defp load_public_path(path, thread) do
    case CMS.FrontDesk.article(%{
           community: path.community,
           thread: thread,
           inner_id: path.inner_id
         }) do
      {:ok, article} -> [article]
      {:error, _reason} -> []
    end
  end
end
