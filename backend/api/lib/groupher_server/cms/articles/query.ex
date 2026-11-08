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
  alias CMS.Articles.Pagination
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.Scope

  alias CMS.Model.Article

  alias Helper.T

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
