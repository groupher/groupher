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

  import Ecto.Query, warn: false

  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias Helper.{Multi, ORM, T}

  alias CMS.FrontDesk
  alias CMS.Gate
  alias CMS.Model.{Comment, PinnedComment}
  alias CMS.Comments.ErrorCat

  @pinned_comment_limit Comment.pinned_comment_limit()

  @doc """
  Pins a comment to the top of the article's comment list.

  The actor-less variant always fails; use `pin/2` with the acting user.

  ## Examples

      CMS.Comments.States.pin(comment_id)
      #=> {:error, %GroupherServer.ErrorCat.Error{reason: :account_login}}

  """
  @spec pin(T.id()) :: T.domain_res(Comment.t())
  def pin(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec pin(T.id(), User.t()) :: T.domain_res(Comment.t())
  def pin(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         {:ok, comment} <- Gate.access_check(user, :pin, comment) do
      pin_unlocked(comment, article)
    end
  end

  @spec undo_pin(T.id()) :: T.domain_res(Comment.t())
  def undo_pin(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec undo_pin(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_pin(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, comment} <- Gate.access_check(user, :pin, comment) do
      undo_pin_unlocked(comment)
    end
  end

  @spec fold(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def fold(%Comment{} = comment, %User{} = _user), do: do_fold_comment(comment, true)

  def fold(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_fold_comment(comment, true)
    end
  end

  @spec unfold(T.id(), User.t()) :: T.domain_res(Comment.t())
  def unfold(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_fold_comment(comment, false)
    end
  end

  @doc false
  @spec fold_for_report(Comment.t()) :: T.domain_res(Comment.t())
  def fold_for_report(%Comment{} = comment) do
    with {:ok, folded_comment} <- ORM.update(comment, %{is_folded: true}),
         {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, %{total_count: total_count}} <-
           CMS.Comments.List.paged_folded_comments(thread, article.id, %{page: 1, size: 1}),
         {:ok, _article} <-
           ORM.update_meta(article, Map.put(article.meta, :folded_comment_count, total_count)) do
      {:ok, folded_comment}
    end
  end

  defp do_fold_comment(%Comment{} = comment, is_folded) when is_boolean(is_folded) do
    Multi.new()
    |> Multi.run(:fold_comment, fn _, _ ->
      comment |> ORM.update(%{is_folded: is_folded})
    end)
    |> Multi.run(:update_article_fold_count, fn _, _ ->
      {:ok, thread} = FrontDesk.thread_of(comment)
      {:ok, article} = FrontDesk.article_of(comment)

      {:ok, %{total_count: total_count}} =
        CMS.Comments.List.paged_folded_comments(thread, article.id, %{page: 1, size: 1})

      meta = article.meta |> Map.put(:folded_comment_count, total_count)
      article |> ORM.update_meta(meta)
    end)
    |> Repo.transaction()
    |> result()
  end

  defp pin_unlocked(%Comment{} = comment, article) do
    with {:ok, comment} <- maybe_existing_pinned_comment(comment),
         {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, info} <- match(thread) do
      Multi.new()
      |> Multi.run(:checked_pined_comments_count, fn _, _ ->
        pined_comments_query =
          from(p in PinnedComment,
            where: field(p, ^info.foreign_key) == ^article.id
          )

        check_pined_comments_count(pined_comments_query)
      end)
      |> Multi.run(:update_comment_flag, fn _, _ ->
        ORM.update(comment, %{is_pinned: true})
      end)
      |> Multi.run(:add_pined_comment, fn _, _ ->
        attrs = %{comment_id: comment.id} |> Map.put(info.foreign_key, article.id)

        PinnedComment |> ORM.create(attrs)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp undo_pin_unlocked(%Comment{} = comment) do
    Multi.new()
    |> Multi.run(:update_comment_flag, fn _, _ ->
      ORM.update(comment, %{is_pinned: false})
    end)
    |> Multi.run(:remove_pined_comment, fn _, _ ->
      ORM.findby_delete(PinnedComment, %{comment_id: comment.id})
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

  defp result({:ok, %{update_comment_flag: result}}), do: {:ok, result}
  defp result({:ok, %{fold_comment: result}}), do: {:ok, result}

  defp result({:error, %GroupherServer.ErrorCat.Error{reason: :already_pinned, details: result}}),
    do: {:ok, result}

  defp result({:error, :update_comment_flag, _result, _steps}),
    do: {:error, ErrorCat.update_fails()}

  defp result({:error, :add_pined_comment, _result, _steps}),
    do: {:error, ErrorCat.create_fails()}

  defp result({:error, :remove_pined_comment, _result, _steps}),
    do: {:error, ErrorCat.delete_fails()}

  defp result({:error, _, result, _steps}), do: {:error, result}
end
