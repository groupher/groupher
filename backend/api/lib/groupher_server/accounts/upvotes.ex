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

  alias GroupherServer.Accounts.Model.User

  alias GroupherServer.CMS.Model.ArticleUpvote
  alias Helper.{ORM, QueryBuilder}

  @threads GroupherServer.CMS.Artiment.Config.threads()

  @doc "Returns paged articles from the `Upvotes` read boundary."
  def paged_articles(%User{id: user_id}, %{thread: thread} = filter) when is_atom(thread) do
    where_query = dynamic([a], a.user_id == ^user_id and a.thread == ^thread)

    load_articles(where_query, filter)
  end

  def paged_articles(%User{}, %{thread: _thread}),
    do: {:error, GroupherServer.ErrorCat.custom("invalid thread")}

  def paged_articles(%User{id: user_id}, filter) do
    where_query = dynamic([a], a.user_id == ^user_id)
    load_articles(where_query, filter)
  end

  defp load_articles(where_query, %{page: page, size: size} = filter) do
    article_preload =
      Enum.reduce(@threads, [], fn thread, acc ->
        acc ++ Keyword.new([{thread, [author: :user]}])
      end)

    query = from(a in ArticleUpvote, preload: ^article_preload)

    query
    |> where(^where_query)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> ORM.extract_articles()
    |> done()
  end
end
