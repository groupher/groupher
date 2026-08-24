defmodule GroupherServer.CMS.Comments.Moderation do
  alias GroupherServer.CMS.QueryBuilder
  @moduledoc """
  Moderation operations for comments.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Moderation
        -> Repo / domain event
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.Repo

  alias GroupherServer.CMS.FrontDesk
  alias GroupherServer.CMS.Model.Comment
  alias Helper.{Multi, ORM, T}

  @audit_legal GroupherServer.CMS.Artiment.Const.moderation_state(:legal)
  @audit_illegal GroupherServer.CMS.Artiment.Const.moderation_state(:illegal)
  @audit_failed GroupherServer.CMS.Artiment.Const.moderation_state(:audit_failed)

  @doc """
  Marks a comment as audited illegal with the given audit details.

  Updates the comment pending flag, stores the legal-state meta, and appends
  the illegal comment to the author's meta before revalidating the user.

  ## Examples

      CMS.Comments.Moderation.set_illegal(comment_id, audit_state)

  """
  @spec set_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def set_illegal(comment_id, audit_state) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_set_illegal(comment, audit_state)
    end
  end

  @spec do_set_illegal(Comment.t(), map()) :: T.domain_res(Comment.t())
  defp do_set_illegal(%Comment{} = comment, audit_state) do
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(comment, %{pending: @audit_illegal})
    end)
    |> Multi.run(:update_comment_meta, fn _, %{update_pending_state: comment} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])

      ORM.update_meta(comment, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      comment = Repo.preload(comment, :author)
      illegal_comments = Map.get(audit_state, :illegal_comments, [])

      with {:ok, user} <- FrontDesk.live_user(comment.author.login) do
        illegal_comments = user.meta.illegal_comments ++ illegal_comments

        user
        |> ORM.update_meta(%{has_illegal_comments: true, illegal_comments: illegal_comments})
        |> revalidate_user(user.login)
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec unset_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def unset_illegal(comment_id, audit_state) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_unset_illegal(comment, audit_state)
    end
  end

  @spec do_unset_illegal(Comment.t(), map()) :: T.domain_res(Comment.t())
  defp do_unset_illegal(%Comment{} = comment, audit_state) do
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(comment, %{pending: @audit_legal})
    end)
    |> Multi.run(:update_comment_meta, fn _, %{update_pending_state: comment} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])
      ORM.update_meta(comment, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      comment = Repo.preload(comment, :author)
      illegal_comments = Map.get(audit_state, :illegal_comments, [])

      with {:ok, user} <- FrontDesk.live_user(comment.author.login) do
        illegal_comments = user.meta.illegal_comments -- illegal_comments
        has_illegal_comments = not Enum.empty?(illegal_comments)

        user
        |> ORM.update_meta(%{
          has_illegal_comments: has_illegal_comments,
          illegal_comments: illegal_comments
        })
        |> revalidate_user(user.login)
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec page_audit_failed(map()) :: T.domain_res(T.paged_data())
  def page_audit_failed(filter) do
    %{page: page, size: size} = filter
    flags = %{pending: @audit_failed}

    Comment
    |> QueryBuilder.filter_pack(Map.merge(filter, flags))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @spec set_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  def set_audit_failed(%Comment{} = comment, _audit_state) do
    ORM.update(comment, %{pending: @audit_failed})
  end

  defp result({:ok, %{update_pending_state: result}}), do: {:ok, result}
  defp result({:ok, %{update_comment_meta: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}

  defp revalidate_user({:ok, _result} = response, login) do
    FrontDesk.revalidate_user(login)
    response
  end

  defp revalidate_user(response, _login), do: response
end
