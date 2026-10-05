defmodule GroupherServer.Accounts.Upvotes do
  @moduledoc """
  Viewer-facing read model for artiments an account has upvoted.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Upvotes
        -> Repo
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, FrontDesk, Repo}

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias Accounts.Model.User
  alias CMS.Model.{ArticleStats, ArticleUpvote}
  alias Helper.{ORM, QueryBuilder}

  @doc "Returns paged articles from the `Upvotes` read boundary."
  def paged_articles(%User{id: user_id}, %{thread: thread} = filter) when is_atom(thread) do
    where_query = dynamic([a], a.user_id == ^user_id and a.thread == ^thread)

    load_articles(where_query, filter)
  end

  def paged_articles(%User{}, %{thread: _thread}) do
    {:error, ProfileErrorCat.custom("invalid thread")}
  end

  def paged_articles(%User{id: user_id}, filter) do
    where_query = dynamic([a], a.user_id == ^user_id)
    load_articles(where_query, filter)
  end

  defp load_articles(where_query, %{page: page, size: size} = filter) do
    query = from(upvote in ArticleUpvote, preload: [article: :community])

    paged =
      query
      |> where(^where_query)
      |> QueryBuilder.filter_pack(filter)
      |> ORM.paginator(~m(page size)a)

    entries =
      Enum.flat_map(paged.entries, fn upvote ->
        article = upvote.article

        case FrontDesk.article(%{
               community: article.community.slug,
               thread: article.thread,
               inner_id: article.inner_id
             }) do
          {:ok, projection} ->
            stats = Repo.get_by(ArticleStats, article_id: article.id, thread: article.thread)

            [
              %{
                author: projection.author,
                id: projection.id,
                inner_id: projection.inner_id,
                thread: projection.thread,
                title: projection.title,
                upvotes_count: if(stats, do: stats.upvotes_count, else: 0)
              }
            ]

          {:error, _reason} ->
            []
        end
      end)

    paged |> Map.put(:entries, entries) |> done()
  end
end
