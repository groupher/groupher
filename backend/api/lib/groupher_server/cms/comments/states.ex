defmodule GroupherServer.CMS.Comments.States do
  @moduledoc """
  State operations for comments (pin, fold).

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Commands.StateChange (transaction and request Community)
        -> States
        -> Repo / domain event
  """

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  alias CMS.{Comments.ErrorCat, FrontDesk}
  alias CMS.Comments.Effects
  alias CMS.Model.{Comment, PinnedComment}
  alias Helper.{ORM, T}

  @pinned_comment_limit Comment.pinned_comment_limit()

  @doc false
  @spec apply_in_transaction(atom(), Comment.t(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Comment.t())
  def apply_in_transaction(action, %Comment{} = comment, article, %User{} = user, command_id) do
    CMS.Comments.Summary.with_change(comment, fn ->
      apply_fact_in_transaction(action, comment, article, user, command_id)
    end)
  end

  defp apply_fact_in_transaction(:pin, %Comment{} = comment, article, %User{} = user, command_id) do
    case maybe_existing_pinned_comment(comment) do
      {:ok, canonical} ->
        with {:ok, thread} <- FrontDesk.thread_of(canonical),
             {:ok, :pass} <-
               check_pined_comments_count(pinned_comments_query(article)),
             {:ok, updated} <- ORM.update(canonical, %{is_pinned: true}),
             {:ok, _pinned} <-
               PinnedComment |> ORM.create(pinned_comment_attrs(article, canonical, thread)),
             {:ok, _activity} <-
               record_pin_activity(canonical, article, :comment_pinned, user,
                 operation_ref: command_id
               ) do
          {:ok, updated}
        end

      {:error, ErrorCat.error_pattern(reason: :already_pinned, details: result)} ->
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp apply_fact_in_transaction(
         :undo_pin,
         %Comment{} = comment,
         article,
         %User{} = user,
         command_id
       ) do
    with {:ok, updated} <- ORM.update(comment, %{is_pinned: false}),
         {:ok, _} <- ORM.findby_delete(PinnedComment, %{comment_id: comment.id}),
         {:ok, _activity} <-
           record_pin_activity(comment, article, :comment_unpinned, user,
             operation_ref: command_id
           ) do
      {:ok, updated}
    end
  end

  @spec fold(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def fold(%Comment{} = comment, %User{} = _user), do: do_fold_comment(comment, true)

  def fold(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      do_fold_comment(comment, true)
    end
  end

  @spec unfold(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def unfold(%Comment{} = comment, %User{} = _user), do: do_fold_comment(comment, false)

  @spec unfold(T.id(), User.t()) :: T.domain_res(Comment.t())
  def unfold(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      do_fold_comment(comment, false)
    end
  end

  defp do_fold_comment(%Comment{} = comment, is_folded) when is_boolean(is_folded) do
    if comment.is_folded == is_folded do
      {:ok, comment}
    else
      CMS.Comments.Summary.with_change(comment, fn ->
        ORM.update(comment, %{is_folded: is_folded})
      end)
    end
  end

  defp pinned_comments_query(%{id: article_id}) do
    from(pin in PinnedComment, where: pin.article_id == ^article_id)
  end

  defp pinned_comment_attrs(%{id: article_id}, comment, _thread) do
    %{comment_id: comment.id, article_id: article_id}
  end

  defp check_pined_comments_count(pined_comments_query) do
    case ORM.count(pined_comments_query) do
      {:ok, pined_comments_count} when pined_comments_count >= @pinned_comment_limit ->
        {:error, ErrorCat.comment_pin_limit(@pinned_comment_limit)}

      {:ok, _} ->
        {:ok, :pass}
    end
  end

  defp maybe_existing_pinned_comment(%Comment{id: comment_id, is_pinned: is_pinned} = comment) do
    case ORM.find_by(PinnedComment, %{comment_id: comment_id}) do
      {:ok, _record} ->
        case is_pinned do
          true ->
            {:error, ErrorCat.already_pinned(comment)}

          false ->
            case ORM.update(comment, %{is_pinned: true}) do
              {:ok, updated} -> {:error, ErrorCat.already_pinned(updated)}
              {:error, reason} -> {:error, reason}
            end
        end

      {:error, _} ->
        {:ok, comment}
    end
  end

  defp record_pin_activity(%Comment{thread: :post} = comment, _article, action, user, opts) do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      Effects.activity(comment, action,
        actor: user,
        community_id: community.id,
        operation_ref: Keyword.fetch!(opts, :operation_ref),
        occurred_at: Keyword.get(opts, :occurred_at, DateTime.utc_now(:second))
      )
    end
  end

  defp record_pin_activity(_comment, _article, _action, _user, _opts), do: {:ok, :skipped}
end
