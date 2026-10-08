defmodule GroupherServer.CMS.Comments.States do
  @moduledoc """
  State operations for comments (pin, fold).

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> States
        -> Repo / domain event
  """

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias CMS.{Comments.ErrorCat, FrontDesk}
  alias CMS.Model.{Comment, PinnedComment}
  alias Helper.{Multi, ORM, T}

  @pinned_comment_limit Comment.pinned_comment_limit()

  @doc """
  Pins a comment to the top of the article's comment list.

  The actor-less variant always fails; use `pin/2` with the acting user.

  ## Examples

      CMS.Comments.States.pin(comment_id)
      #=> {:error, ErrorCat.error_pattern(reason: :account_login)}

  """
  @spec pin(T.id()) :: T.domain_res(Comment.t())
  def pin(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec pin(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def pin(%Comment{} = comment, %User{} = user) do
    pin(comment, user, operation_ref: Ecto.UUID.generate())
  end

  @spec pin(T.id(), User.t()) :: T.domain_res(Comment.t())
  def pin(comment_id, %User{} = user) do
    pin(comment_id, user, operation_ref: Ecto.UUID.generate())
  end

  @doc false
  def pin(%Comment{} = comment, %User{} = user, opts) do
    CMS.Gate.with_check(user, :pin, comment, fn canonical, article ->
      pin_unlocked(canonical, article, user, opts)
    end)
  end

  def pin(comment_id, %User{} = user, opts) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal),
         {:ok, result} <- pin(comment, user, opts) do
      {:ok, result}
    end
  end

  @spec undo_pin(T.id()) :: T.domain_res(Comment.t())
  def undo_pin(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec undo_pin(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def undo_pin(%Comment{} = comment, %User{} = user) do
    undo_pin(comment, user, operation_ref: Ecto.UUID.generate())
  end

  @spec undo_pin(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_pin(comment_id, %User{} = user) do
    undo_pin(comment_id, user, operation_ref: Ecto.UUID.generate())
  end

  @doc false
  def undo_pin(%Comment{} = comment, %User{} = user, opts) do
    CMS.Gate.with_check(user, :pin, comment, fn canonical, article ->
      undo_pin_unlocked(canonical, article, user, opts)
    end)
  end

  def undo_pin(comment_id, %User{} = user, opts) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal),
         {:ok, result} <- undo_pin(comment, user, opts) do
      {:ok, result}
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

  @doc false
  @spec fold_for_report(Comment.t()) :: T.domain_res(Comment.t())
  def fold_for_report(%Comment{} = comment), do: ORM.update(comment, %{is_folded: true})

  defp do_fold_comment(%Comment{} = comment, is_folded) when is_boolean(is_folded) do
    ORM.update(comment, %{is_folded: is_folded})
  end

  defp pin_unlocked(%Comment{} = comment, article, user, opts) do
    with {:ok, comment} <- maybe_existing_pinned_comment(comment),
         {:ok, thread} <- FrontDesk.thread_of(comment) do
      Multi.new()
      |> Multi.run(:checked_pined_comments_count, fn _, _ ->
        pined_comments_query = pinned_comments_query(article, comment.branch_id, thread)

        check_pined_comments_count(pined_comments_query)
      end)
      |> Multi.run(:update_comment_flag, fn _, _ ->
        ORM.update(comment, %{is_pinned: true})
      end)
      |> Multi.run(:add_pined_comment, fn _, _ ->
        attrs = pinned_comment_attrs(article, comment, thread)

        PinnedComment |> ORM.create(attrs)
      end)
      |> Multi.run(:activity, fn _, _ ->
        record_pin_activity(comment, article, :comment_pinned, user, opts)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp pinned_comments_query(%{id: article_id}, nil, _thread) do
    from(pin in PinnedComment,
      where: pin.article_id == ^article_id and is_nil(pin.branch_id)
    )
  end

  defp pinned_comments_query(%{id: article_id}, branch_id, _thread) do
    from(pin in PinnedComment,
      where: pin.article_id == ^article_id and pin.branch_id == ^branch_id
    )
  end

  defp pinned_comment_attrs(%{id: article_id}, comment, _thread) do
    %{comment_id: comment.id, article_id: article_id, branch_id: comment.branch_id}
  end

  defp undo_pin_unlocked(%Comment{} = comment, article, user, opts) do
    Multi.new()
    |> Multi.run(:update_comment_flag, fn _, _ ->
      ORM.update(comment, %{is_pinned: false})
    end)
    |> Multi.run(:remove_pined_comment, fn _, _ ->
      ORM.findby_delete(PinnedComment, %{comment_id: comment.id})
    end)
    |> Multi.run(:activity, fn _, _ ->
      record_pin_activity(comment, article, :comment_unpinned, user, opts)
    end)
    |> Repo.transaction()
    |> result()
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
    Activity.log(comment, action,
      actor: user,
      operation_ref: Keyword.fetch!(opts, :operation_ref),
      occurred_at: Keyword.get(opts, :occurred_at, DateTime.utc_now(:second))
    )
  end

  defp record_pin_activity(_comment, _article, _action, _user, _opts), do: {:ok, :skipped}

  defp result({:ok, %{update_comment_flag: result}}), do: {:ok, result}
  defp result({:ok, %{fold_comment: result}}), do: {:ok, result}

  defp result({:error, ErrorCat.error_pattern(reason: :already_pinned, details: result)}) do
    {:ok, result}
  end

  defp result({:error, :update_comment_flag, _result, _steps}) do
    {:error, ErrorCat.update_fails()}
  end

  defp result({:error, :add_pined_comment, _result, _steps}) do
    {:error, ErrorCat.create_fails()}
  end

  defp result({:error, :remove_pined_comment, _result, _steps}) do
    {:error, ErrorCat.delete_fails()}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
