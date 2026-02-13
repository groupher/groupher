defmodule GroupherServer.CMS.Delegate.Fetcher do
  @moduledoc """
  Domain fetch helpers for comment resources.
  """

  import Ecto.Query, warn: false

  import Helper.Utils,
    only: [done: 1, get_config: 2]

  alias Helper.Types, as: T
  alias Helper.ORM
  alias GroupherServer.Repo

  alias GroupherServer.CMS.Model.Comment

  @article_threads get_config(:article, :threads)

  @spec fetch_comment(integer()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id) do
    ORM.find(Comment, comment_id)
  end

  @spec fetch_full_comment(integer()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    get_full_comment(comment_id)
  end

  @spec fetch(Ecto.Queryable.t(), T.id()) :: T.domain_res(term())
  def fetch(queryable, id), do: ORM.find(queryable, id)

  @spec fetch(Ecto.Queryable.t(), T.id(), keyword()) :: T.domain_res(term())
  def fetch(queryable, id, preload: preload), do: ORM.find(queryable, id, preload: preload)

  @spec fetch_by(Ecto.Queryable.t(), map()) :: T.domain_res(term())
  def fetch_by(queryable, clauses), do: ORM.find_by(queryable, clauses)

  @spec fetch_by(Ecto.Queryable.t(), map(), keyword()) :: T.domain_res(term())
  def fetch_by(queryable, clauses, preload: preload),
    do: ORM.find_by(queryable, clauses, preload: preload)

  @spec get_full_comment(integer()) :: T.domain_res(T.article_info())
  defp get_full_comment(comment_id) do
    query = from(c in Comment, where: c.id == ^comment_id, preload: ^@article_threads)

    with {:ok, comment} <- Repo.one(query) |> done(),
         article_thread <- find_comment_article_thread(comment) do
      do_extract_article_info(article_thread, Map.get(comment, article_thread))
    end
  end

  @spec do_extract_article_info(T.article_thread(), T.article_common()) :: {:ok, T.article_info()}
  defp do_extract_article_info(thread, article) do
    with {:ok, article_with_author} <- Repo.preload(article, author: :user) |> done(),
         article_author <- get_in(article_with_author, [:author, :user]) do
      article_info = %{title: article.title, id: article.id}

      author_info = %{
        id: article_author.id,
        login: article_author.login,
        nickname: article_author.nickname
      }

      {:ok, %{thread: thread, article: article_info, author: author_info}}
    end
  end

  defp find_comment_article_thread(%Comment{} = comment) do
    @article_threads
    |> Enum.filter(&Map.get(comment, :"#{&1}_id"))
    |> List.first()
  end
end
