defmodule GroupherServer.CMS.FrontDesk.Relation do
  @moduledoc """
  Resolves Article/Comment authorship, parent Article, and thread relationships.

  Business position:

      CMS.FrontDesk facade / FrontDesk readers
        -> FrontDesk.Relation
        -> Repo / FrontDesk.Lookup
  """

  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.ErrorCat

  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.FrontDesk.Lookup
  alias CMS.Model.Comment

  @doc "Preloads the author relation expected by Article or Comment callers."
  def preload_author(%Comment{} = comment), do: Repo.preload(comment, :author) |> done()

  def preload_author(article) do
    case article do
      %{author: %Ecto.Association.NotLoaded{}} -> Repo.preload(article, author: :user)
      %{author: %{user: %Ecto.Association.NotLoaded{}}} -> Repo.preload(article, author: :user)
      %{author: nil} -> article
      %{author: %{user: _}} -> article
      _ -> Repo.preload(article, author: :user)
    end
    |> done()
  end

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
  def author_of(article) do
    case Ecto.assoc_loaded?(article.author) do
      true -> article.author.user
      false -> Repo.preload(article, author: :user) |> get_in([:author, :user])
    end
    |> done()
  end

  @doc "Returns the parent Article of a Comment."
  @spec article_of(Comment.t(), keyword()) :: {:ok, map()} | {:error, map()}
  def article_of(comment, opts \\ [])

  def article_of(%Comment{} = comment, opts) when is_list(opts) do
    preload = Keyword.get(opts, :preload, [])

    with {:ok, thread} <- thread_of(comment),
         {:ok, info} <- match(thread),
         article_id when not is_nil(article_id) <- Map.get(comment, info.foreign_key),
         {:ok, article} <- Lookup.get(info.model, article_id, preload: preload) do
      {:ok, article}
    else
      nil -> {:error, ErrorCat.custom("invalid article")}
      {:error, _} = error -> error
    end
  end

  def article_of(_, _opts), do: {:error, ErrorCat.custom("only support comment")}

  @doc "Returns the canonical thread of a Comment or Article projection."
  @spec thread_of(Comment.t() | map()) :: {:ok, atom()} | {:error, map()}
  def thread_of(%Comment{thread: thread}) when is_atom(thread) and not is_nil(thread),
    do: Threads.to_atom(thread)

  def thread_of(%{meta: %{thread: thread}}) when is_atom(thread) and not is_nil(thread),
    do: Threads.to_atom(thread)

  def thread_of(_), do: {:error, ErrorCat.custom("invalid article")}

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}
end
