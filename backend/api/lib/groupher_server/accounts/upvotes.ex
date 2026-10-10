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
  alias CMS.Model.{ArticleBinding, ArticleStats, ArticleUpvote}
  alias Helper.{ORM, QueryBuilder}

  @doc "Returns paged articles from the `Upvotes` read boundary."
  def paged_articles(%User{id: user_id}, %{thread: thread} = filter) when is_atom(thread) do
    load_articles(user_id, thread, filter)
  end

  def paged_articles(%User{}, %{thread: _thread}) do
    {:error, ProfileErrorCat.custom("invalid thread")}
  end

  def paged_articles(%User{id: user_id}, filter) do
    load_articles(user_id, nil, filter)
  end

  defp load_articles(user_id, thread, %{page: page, size: size} = filter) do
    query =
      from(binding in ArticleBinding,
        join: upvote in ArticleUpvote,
        on: upvote.article_id == binding.article_id,
        where: upvote.user_id == ^user_id,
        preload: [:article, :community],
        distinct: binding.id
      )

    query =
      if is_nil(thread),
        do: query,
        else: where(query, [binding, upvote], upvote.thread == ^thread)

    paged =
      query
      |> QueryBuilder.filter_pack(filter)
      |> ORM.paginator(~m(page size)a)

    entries =
      Enum.flat_map(paged.entries, fn binding ->
        article = binding.article

        case FrontDesk.article(%{
               community: binding.community.slug,
               thread: article.thread,
               inner_id: binding.inner_id
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
