defmodule GroupherServer.CMS.Comments.Query.Reconcile do
  @moduledoc """
  Bounded reconciliation and internal binding reads for comments.

  Business position:

      Client
        -> GraphQL
      -> CMS.Comments
        -> Comments.Query.Reconcile
          -> Repo / FrontDesk
  """

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Comments.InteractionResponse
  alias CMS.Articles.Bindings
  alias CMS.FrontDesk
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Helper.{ArticlePath, EmotionFormatter}
  alias CMS.Model.Comment
  alias Helper.{ORM, T}

  @batch_size 100

  @doc """
  Fetches one comment through the FrontDesk read boundary.

  ## Examples

      CMS.Comments.Query.Reconcile.fetch_comment(comment_id)

  """
  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id) do
    FrontDesk.comment(comment_id, mode: :internal) |> normalize_error()
  end

  @doc "Loads the User who authored one Comment."
  @spec load_comment_author(T.id()) :: T.domain_res(User.t())
  def load_comment_author(comment_id) do
    with {:ok, %Comment{author: author}} <- ORM.find(Comment, comment_id, preload: :author) do
      {:ok, author}
    end
  end

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    FrontDesk.comment(comment_id, mode: :internal, view: :article_context) |> normalize_error()
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
    with {:ok, _} <- validate_batch(inner_ids),
         {:ok, inner_ids} <- parse_inner_ids(inner_ids) do
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

  @doc """
  Returns the viewer-owned Comment projection for one public Article path.

  Missing or unreadable Comment ids are omitted. Anonymous transport behavior
  is intentionally decided by the caller; this query accepts an authenticated
  viewer because every returned field is private viewer state.
  """
  @spec viewer_states(map(), [integer() | String.t()], User.t()) ::
          T.domain_res([map()])
  def viewer_states(article_path, inner_ids, %User{} = viewer) when is_list(inner_ids) do
    with {:ok, _} <- validate_batch(inner_ids),
         {:ok, {thread, article}} <- resolve_article(article_path),
         {:ok, comments} <- reconcile_comments(thread, article, inner_ids, viewer) do
      {:ok,
       Enum.map(comments, fn comment ->
         %{
           inner_id: comment.inner_id,
           viewer_has_upvoted: comment.viewer_has_upvoted,
           viewer_has_reported: comment.viewer_has_reported,
           emotions: viewer_emotions(comment)
         }
       end)}
    end
  end

  @doc """
  Returns the complete Comment reconciliation read model for one public
  Article path.

  Entry order follows the input ids and missing or unreadable Comments are
  represented by a `nil` Comment. Article aggregate revision and Comment
  interaction revision remain independently observed owner revisions.
  """
  @spec reconcile_states(map(), [integer() | String.t()], User.t() | nil) ::
          T.domain_res(map())
  def reconcile_states(article_path, inner_ids, viewer) when is_list(inner_ids) do
    with {:ok, _} <- validate_batch(inner_ids),
         {:ok, {thread, article}} <- resolve_article(article_path),
         {:ok, comments} <- reconcile_comments(thread, article, inner_ids, viewer) do
      stats =
        CMS.ArticleStats.for_articles(thread, [article])
        |> Map.get({thread, article.id}, %{})

      comments_by_inner_id = Map.new(comments, &{to_string(&1.inner_id), &1})

      entries =
        Enum.map(inner_ids, fn inner_id ->
          comment =
            comments_by_inner_id
            |> Map.get(to_string(inner_id))
            |> attach_article(article)

          %{comment_inner_id: inner_id, comment: comment}
        end)

      with {:ok, %{inner_id: inner_id}} <-
             Bindings.get(article, Map.get(article, :community)) do
        {:ok,
         %{
           article: %{
             inner_id: inner_id,
             comments_count: Map.get(stats, :comments_count, 0),
             comments_revision: Map.get(stats, :comments_revision, 0)
           },
           entries: entries
         }}
      end
    end
  end

  defp normalize_error(
         {:error,
          CommentErrorCat.error_pattern(
            reason: :custom,
            details: %{reason: :not_exist, message: message}
          )}
       ) do
    {:error, CommentErrorCat.not_exist(to_string(message))}
  end

  defp normalize_error(
         {:error,
          CommentErrorCat.error_pattern(
            reason: :custom,
            details: %{reason: :not_exist}
          )}
       ) do
    {:error, CommentErrorCat.not_exist("comment not found")}
  end

  defp normalize_error(result), do: result

  defp comment_scope(:doc), do: CommentContext.for_thread(:doc, branch_policy: :main)
  defp comment_scope(thread), do: CommentContext.for_thread(thread)

  defp resolve_article(article_path) do
    with {:ok, %{thread: thread} = article_path} <- ArticlePath.parse(article_path),
         {:ok, article} <- FrontDesk.article(article_path) do
      {:ok, {thread, article}}
    end
  end

  defp viewer_emotions(comment) do
    comment
    |> EmotionFormatter.format(:comment)
    |> Enum.map(fn emotion ->
      %{type: emotion.type, viewer_has_reacted: emotion.viewer_has_reacted}
    end)
  end

  defp attach_article(nil, _article), do: nil
  defp attach_article(comment, article), do: Map.put(comment, :article, article)

  defp validate_batch(values) when length(values) <= @batch_size, do: {:ok, :pass}
  defp validate_batch(_values), do: {:error, "viewer batch cannot contain more than 100 paths"}

  defp parse_inner_id(value) when is_integer(value) and value >= 0, do: {:ok, value}

  defp parse_inner_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} when integer >= 0 ->
        if Integer.to_string(integer) == value do
          {:ok, integer}
        else
          {:error, CommentErrorCat.not_exist("comment not found")}
        end

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
