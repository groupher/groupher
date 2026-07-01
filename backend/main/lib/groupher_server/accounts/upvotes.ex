defmodule GroupherServer.Accounts.Upvotes do
  @moduledoc """
  Accounts upvotes facade.
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, get_config: 2]
  import ShortMaps

  alias GroupherServer.CMS

  alias CMS.Model.ArticleUpvote
  alias Helper.{ORM, QueryBuilder}

  @threads get_config(:article, :threads)

  def paged_articles(user_id, %{thread: thread} = filter) when is_atom(thread) do
    where_query = dynamic([a], a.user_id == ^user_id and a.thread == ^thread)

    load_articles(where_query, filter)
  end

  def paged_articles(_user_id, %{thread: _thread}), do: {:error, {:custom, "invalid thread"}}

  def paged_articles(user_id, filter) do
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
