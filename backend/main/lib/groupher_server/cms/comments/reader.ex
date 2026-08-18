defmodule GroupherServer.CMS.Comments.Reader do
  @moduledoc """
  Read operations for comments.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Reader
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User

  alias CMS.FrontDesk
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Gate.Context.Scope.Comment, as: CommentScope
  alias CMS.Helper.ArticlePath
  alias CMS.Model.Comment
  alias CMS.Interactions.State
  alias GroupherServer.Repo
  alias Helper.{ORM, T}

  @doc """
  Fetches one comment through the FrontDesk read boundary.

  ## Examples

      CMS.Comments.Reader.fetch_comment(comment_id)

  """
  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id) do
    FrontDesk.comment(comment_id) |> normalize_error()
  end

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    FrontDesk.full_comment(comment_id) |> normalize_error()
  end

  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{thread: thread} = comment),
    do: read_by_id(comment.id, nil, thread)

  def one_comment(%{article: article_path, inner_id: inner_id}),
    do: read_by_path(article_path, inner_id, nil) |> normalize_error()

  def one_comment(id) do
    with %Comment{thread: thread} <- Repo.get(Comment, id) do
      read_by_id(id, nil, thread)
    else
      nil -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  @spec one_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{thread: thread} = comment, %User{} = user) do
    with {:ok, comment} <- read_by_id(comment.id, user, thread) do
      add_viewer_states(comment, user)
    end
  end

  def one_comment(%{article: article_path, inner_id: inner_id}, %User{} = user) do
    with {:ok, comment} <- read_by_path(article_path, inner_id, user) |> normalize_error() do
      add_viewer_states(comment, user)
    end
  end

  def one_comment(id, %User{} = user) do
    with %Comment{thread: thread} <- Repo.get(Comment, id),
         {:ok, comment} <- read_by_id(id, user, thread) do
      add_viewer_states(comment, user)
    else
      nil -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  defp normalize_error(
         {:error,
          %GroupherServer.ErrorCat.Error{
            reason: :custom,
            details: %{reason: :not_exist, message: message}
          }}
       ),
       do: {:error, CommentErrorCat.not_exist(to_string(message))}

  defp normalize_error(
         {:error,
          %GroupherServer.ErrorCat.Error{
            reason: :custom,
            details: %{reason: :not_exist}
          }}
       ),
       do: {:error, CommentErrorCat.not_exist("comment not found")}

  defp normalize_error(result), do: result

  defp read_by_id(id, actor, thread) do
    Comment
    |> CMS.Gate.scope(actor, :read, comment_scope(thread))
    |> where([comment], comment.id == ^id)
    |> preload(:author)
    |> Repo.one()
    |> ORM.fill_meta()
  end

  defp read_by_path(article_path, comment_inner_id, actor) do
    with {:ok, %{community: community, thread: thread, inner_id: article_inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, comment_inner_id} <- parse_inner_id(comment_inner_id) do
      Comment
      |> CMS.Gate.scope(actor, :read, comment_scope(thread))
      |> join(:inner, [comment, ...], article in assoc(comment, ^thread))
      |> where([comment, ...], comment.inner_id == ^comment_inner_id)
      |> where([_comment, ..., article], article.inner_id == ^article_inner_id)
      |> where(
        [_comment, ...],
        as(:gate_community).slug == ^community or as(:gate_community).aka == ^community
      )
      |> preload([comment, ...], author: :user)
      |> Repo.one()
      |> ORM.fill_meta()
    end
  end

  defp add_viewer_states(comment, user) do
    comment |> State.read(user) |> done
  end

  defp comment_scope(:doc), do: CommentScope.for_thread(:doc, branch_policy: :main)
  defp comment_scope(thread), do: CommentScope.for_thread(thread)

  defp parse_inner_id(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp parse_inner_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} when integer >= 0 -> {:ok, integer}
      _ -> {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  defp parse_inner_id(_value), do: {:error, CommentErrorCat.not_exist("comment not found")}
end
