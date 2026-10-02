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

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Comments.InteractionResponse
  alias CMS.FrontDesk
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Helper.ArticlePath
  alias CMS.Model.Comment
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

  @doc "Loads one Comment row for a Comment-owned command or writer."
  @spec load(T.id()) :: T.domain_res(Comment.t())
  def load(comment_id), do: ORM.find(Comment, comment_id)

  @doc "Loads the User who authored one Comment."
  @spec load_comment_author(T.id()) :: T.domain_res(User.t())
  def load_comment_author(comment_id) do
    with {:ok, %Comment{author: author}} <- ORM.find(Comment, comment_id, preload: :author) do
      {:ok, author}
    end
  end

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    FrontDesk.full_comment(comment_id) |> normalize_error()
  end

  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{thread: thread} = comment) do
    with {:ok, comment} <- read_by_id(comment.id, nil, thread) do
      add_viewer_states(comment, nil)
    end
  end

  def one_comment(%{article: article_path, inner_id: inner_id}) do
    with {:ok, comment} <- read_by_path(article_path, inner_id, nil) |> normalize_error() do
      add_viewer_states(comment, nil)
    end
  end

  def one_comment(id) do
    with %Comment{thread: thread} <- Repo.get(Comment, id),
         {:ok, comment} <- read_by_id(id, nil, thread) do
      add_viewer_states(comment, nil)
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

  @doc """
  Reads up to one bounded Article-scoped set of Comments in one database query
  and hydrates their current interaction projection for an optional viewer.

  Missing inner ids are intentionally omitted. The GraphQL reconciliation
  boundary restores them as explicit `nil` entries so delete receipts can
  converge without turning a missing Comment into a query error.
  """
  @spec reconcile_comments(atom(), struct(), [integer() | String.t()], User.t() | nil) ::
          T.domain_res([Comment.t()])
  def reconcile_comments(thread, article, inner_ids, viewer)
      when is_atom(thread) and is_list(inner_ids) do
    with {:ok, inner_ids} <- parse_inner_ids(inner_ids) do
      comments =
        Comment
        |> CMS.Gate.scope(viewer, :read, comment_scope(thread))
        |> where(
          [comment],
          comment.article_id == ^article.id and comment.thread == ^thread and
            comment.inner_id in ^inner_ids
        )
        |> preload(:author)
        |> Repo.all()

      InteractionResponse.many(comments, viewer)
    end
  end

  defp normalize_error(
         {:error,
          CommentErrorCat.error_pattern(
            reason: :custom,
            details: %{reason: :not_exist, message: message}
          )}
       ),
       do: {:error, CommentErrorCat.not_exist(to_string(message))}

  defp normalize_error(
         {:error,
          CommentErrorCat.error_pattern(
            reason: :custom,
            details: %{reason: :not_exist}
          )}
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
    InteractionResponse.one(comment, user)
  end

  defp comment_scope(:doc), do: CommentContext.for_thread(:doc, branch_policy: :main)
  defp comment_scope(thread), do: CommentContext.for_thread(thread)

  defp parse_inner_id(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp parse_inner_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} when integer >= 0 ->
        if Integer.to_string(integer) == value,
          do: {:ok, integer},
          else: {:error, CommentErrorCat.not_exist("comment not found")}

      _ ->
        {:error, CommentErrorCat.not_exist("comment not found")}
    end
  end

  defp parse_inner_id(_value), do: {:error, CommentErrorCat.not_exist("comment not found")}

  defp parse_inner_ids(values) do
    values
    |> Enum.reduce_while({:ok, []}, fn value, {:ok, acc} ->
      case parse_inner_id(value) do
        {:ok, inner_id} -> {:cont, {:ok, [inner_id | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, inner_ids} -> {:ok, Enum.reverse(inner_ids)}
      error -> error
    end
  end
end
