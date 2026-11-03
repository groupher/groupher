defmodule GroupherServer.CMS.FrontDesk.Relation do
  @moduledoc """
  Resolves Article/Comment authorship, parent Article, and thread relationships.

  Business position:

      CMS.FrontDesk facade / FrontDesk readers
        -> FrontDesk.Relation
        -> Repo / owning Query
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.ErrorCat

  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.FrontDesk.Article, as: ArticleFrontDesk
  alias CMS.Model.{Article, ArticleBinding, Comment, Community}

  @doc "Returns the author of an Article or Comment."
  @spec author_of(Comment.t()) :: {:ok, map()} | {:error, map()}
  def author_of(%Comment{} = comment) do
    case Ecto.assoc_loaded?(comment.author) do
      true -> comment.author
      false -> Repo.preload(comment, :author) |> Map.get(:author)
    end
    |> done()
  end

  @spec author_of(map()) :: {:ok, User.t()} | {:error, map()}
  def author_of(%{article_id: article_id, author: %User{} = author}) when is_binary(article_id) do
    {:ok, author}
  end

  def author_of(article) do
    case Ecto.assoc_loaded?(article.author) do
      true -> article.author.user
      false -> Repo.preload(article, author: :user) |> get_in([:author, :user])
    end
    |> done()
  end

  @doc "Returns the parent Article through the Comment's origin Community."
  @spec article_of(Comment.t()) :: {:ok, map()} | {:error, map()}

  def article_of(%Comment{origin_community_id: community_id} = comment)
      when is_integer(community_id) do
    with {:ok, thread} <- thread_of(comment),
         %Community{} = community <- Repo.get(Community, community_id),
         %ArticleBinding{inner_id: inner_id} <-
           Repo.get_by(ArticleBinding,
             article_id: comment.article_id,
             community_id: community_id
           ),
         {:ok, projection} <-
           ArticleFrontDesk.read(
             %{community: community.slug, thread: thread, inner_id: inner_id},
             nil,
             []
           ) do
      {:ok, projection}
    else
      nil -> {:error, ErrorCat.custom("invalid article")}
      {:error, _} = error -> error
    end
  end

  def article_of(_), do: {:error, ErrorCat.custom("only support comment")}

  @doc "Returns the canonical thread of a Comment or Article projection."
  @spec thread_of(Comment.t() | map()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%Comment{thread: thread}) when is_atom(thread) and not is_nil(thread) do
    Threads.to_atom(thread)
  end

  def thread_of(%Article{thread: :ticket}), do: {:ok, :ticket}
  def thread_of(%Article{thread: thread}) when is_atom(thread), do: Threads.to_atom(thread)

  def thread_of(%{article_id: article_id, thread: :ticket}) when is_binary(article_id) do
    {:ok, :ticket}
  end

  def thread_of(%{article_id: article_id, thread: thread})
      when is_binary(article_id) and is_atom(thread) do
    Threads.to_atom(thread)
  end

  def thread_of(%{meta: %{thread: thread}}) when is_atom(thread) and not is_nil(thread) do
    Threads.to_atom(thread)
  end

  def thread_of(_), do: {:error, ErrorCat.custom("invalid article")}

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}
end
