defmodule GroupherServer.CMS.Articles.Query do
  @moduledoc """
  Collection and composite Article queries. This module does not own
  single-resource loading; callers use FrontDesk for canonical Article reads.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Query
        -> Gate-scoped Query / Pagination
        -> Repo -> list projection

  Kanban and published-owner views share the canonical ArticleLite selector,
  binding identity and PageInfo contract.
  """

  import Ecto.Query, warn: false

  import Helper.Utils,
    only: [
      done: 1
    ]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.{Pagination, Query.Locator}
  alias CMS.Artiment.Const
  alias CMS.Dashboard.KanbanBoards
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.Scope

  alias CMS.Model.{
    Article,
    Community
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
  Bootstraps enabled Kanban columns as independent canonical Post pages.

  ## Examples

      Query.grouped_kanban(community)
      #=> {:ok, %{backlog: page, todo: page, ...}}
  """
  @spec grouped_kanban(Community.t()) :: T.domain_res(map())
  def grouped_kanban(%Community{} = community) do
    enabled = enabled_kanban_boards(community)

    Enum.reduce_while(KanbanBoards.values_list(), {:ok, %{}}, fn board, {:ok, pages} ->
      filter =
        if board in enabled, do: %{status: kanban_board_status(board)}, else: %{statuses: []}

      filter =
        case filter do
          %{status: statuses} when is_list(statuses) -> %{statuses: statuses}
          other -> other
        end

      case kanban_page(community, filter, nil) do
        {:ok, page} -> {:cont, {:ok, Map.put(pages, board, page)}}
        error -> {:halt, error}
      end
    end)
  end

  defp enabled_kanban_boards(community) do
    community
    |> Repo.preload(:dashboard, force: true)
    |> get_in([Access.key(:dashboard), Access.key(:layout), Access.key(:kanban_boards)])
    |> case do
      boards when is_list(boards) and boards != [] -> boards
      _ -> KanbanBoards.default_values_list()
    end
  end

  defp kanban_board_status(:backlog), do: @article_status.backlog
  defp kanban_board_status(:todo), do: @article_status.todo
  defp kanban_board_status(:wip), do: @article_status.wip
  defp kanban_board_status(:done), do: @article_status.done
  defp kanban_board_status(:rejected), do: @kanban_rejected_statuses

  @doc """
  Pages a Kanban status set using the canonical Article list selector.

  ## Examples

      Query.kanban_page(community, %{status: :todo}, nil)
      #=> {:ok, page}
  """
  @spec kanban_page(Community.t(), map(), term()) :: T.domain_res(term())
  def kanban_page(%Community{} = community, filter, pagi) do
    filter = filter |> Map.put(:community, community.slug) |> Map.put_new(:order, :publish)
    Pagination.page(:post, filter, pagi, nil, include_pinned: true)
  end

  @doc """
  Pages public binding paths authored by the target user.

  ## Examples

      Query.paged_published(:post, %{order: :publish}, nil, author, viewer)
      #=> {:ok, page}
  """
  @spec paged_published(atom(), map(), term(), User.t(), User.t() | nil) :: T.domain_res(term())
  def paged_published(thread, filter, pagi, %User{} = target_user, viewer) do
    filter = Map.put(filter, :author_id, target_user.id)
    Pagination.page(thread, filter, pagi, viewer, include_pinned: true)
  end

  @doc "Resolves Article locators in a bounded batch through the canonical Gate scope."
  @spec locators([map()]) :: T.domain_res([map()])
  def locators(locators), do: Locator.resolve(locators)

  @doc """
  Counts the target user's publicly visible Articles in one thread.

  The count uses the same public Gate scope as Article lists; moderation-hidden,
  deleted, or otherwise non-readable rows are excluded.

  ## Examples

      CMS.Articles.count_published(:post, author)
  """
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

  defp scope_context(:doc), do: DocContext.public_main()
  defp scope_context(thread), do: ArticleContext.public(thread)

  @doc """
  Preloads the author association on an already canonical Article for result assembly.

  This helper does not load an Article by ID and does not replace FrontDesk or
  Gate authorization. Comment create and replay use it after the Article has
  already been resolved by the command pipeline.

  ## Examples

      CMS.Articles.Query.article_with_author(canonical_article)
  """
  @spec article_with_author(Article.t()) :: Article.t()
  def article_with_author(%Article{} = article), do: Repo.preload(article, author: :user)
end
