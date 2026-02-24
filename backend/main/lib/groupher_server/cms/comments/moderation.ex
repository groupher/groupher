defmodule GroupherServer.CMS.Comments.Moderation do
  @moduledoc """
  Moderation operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.FrontDesk, as: GlobalFrontDesk
  alias GroupherServer.{CMS, Repo}
  alias CMS.FrontDesk
  alias Helper.Types, as: T
  alias Helper.{ORM, QueryBuilder}

  alias CMS.Model.Comment

  alias Ecto.Multi

  @audit_legal Helper.Constant.CMS.pending(:legal)
  @audit_illegal Helper.Constant.CMS.pending(:illegal)
  @audit_failed Helper.Constant.CMS.pending(:audit_failed)

  @spec set_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def set_comment_illegal(comment_id, audit_state) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_set_comment_illegal(comment, audit_state)
    end
  end

  @spec do_set_comment_illegal(Comment.t(), map()) :: T.domain_res(Comment.t())
  defp do_set_comment_illegal(%Comment{} = comment, audit_state) do
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(comment, %{pending: @audit_illegal})
    end)
    |> Multi.run(:update_comment_meta, fn _, %{update_pending_state: comment} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])

      ORM.update_meta(comment, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      illegal_comments = Map.get(audit_state, :illegal_comments, [])

      with {:ok, user} <- GlobalFrontDesk.user(comment.author_id) do
        illegal_comments = user.meta.illegal_comments ++ illegal_comments

        ORM.update_meta(user, %{has_illegal_comments: true, illegal_comments: illegal_comments})
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec unset_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def unset_comment_illegal(comment_id, audit_state) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_unset_comment_illegal(comment, audit_state)
    end
  end

  @spec do_unset_comment_illegal(Comment.t(), map()) :: T.domain_res(Comment.t())
  defp do_unset_comment_illegal(%Comment{} = comment, audit_state) do
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(comment, %{pending: @audit_legal})
    end)
    |> Multi.run(:update_comment_meta, fn _, %{update_pending_state: comment} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])
      ORM.update_meta(comment, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      illegal_comments = Map.get(audit_state, :illegal_comments, [])

      with {:ok, user} <- GlobalFrontDesk.user(comment.author_id) do
        illegal_comments = user.meta.illegal_comments -- illegal_comments
        has_illegal_comments = not Enum.empty?(illegal_comments)

        ORM.update_meta(user, %{
          has_illegal_comments: has_illegal_comments,
          illegal_comments: illegal_comments
        })
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec paged_audit_failed_comments(map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed_comments(filter) do
    %{page: page, size: size} = filter
    flags = %{pending: @audit_failed}

    Comment
    |> QueryBuilder.filter_pack(Map.merge(filter, flags))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @spec set_comment_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  def set_comment_audit_failed(%Comment{} = comment, _audit_state) do
    ORM.update(comment, %{pending: @audit_failed})
  end

  defp result({:ok, %{update_pending_state: result}}), do: {:ok, result}
  defp result({:ok, %{update_comment_meta: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
