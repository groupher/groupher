defmodule GroupherServer.CMS.Comments.Commands.DeleteComment do
  @moduledoc """
  Soft-deletes a Comment and reconciles the current Post solution atomically.

      target Comment
        -> Gate authorization + parent aggregate transaction/lock
        -> if current solution: revoke relation + solution Activity
        -> remove independent pin -> transition Lifecycle -> tombstone body
        -> commit -> enqueue search metrics projection

  A future physical hard-destroy command remains a separate operation; its
  foreign-key cascade semantics are not simulated here.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.{FrontDesk, Gate}
  alias GroupherServer.CMS.Comments.{Lifecycle, ErrorCat}
  alias GroupherServer.CMS.Comments.Commands.SolutionTransition
  alias GroupherServer.CMS.Model.{Comment, PinnedComment, Post}
  alias GroupherServer.CMS.SearchArtiments.Indexer
  alias Helper.{ORM, T}

  @delete_hint Comment.delete_hint()

  @doc """
  Soft-deletes one authorized Comment without leaving a live solution relation.

  ## Examples

      DeleteComment.execute(comment, actor)
      #=> {:ok, %Comment{body_html: "this comment is deleted"}} | {:error, reason}
  """
  @spec execute(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def execute(%Comment{} = comment, %User{} = actor) do
    case Gate.Access.with_check(actor, :delete, comment, fn canonical ->
           delete_locked(canonical, actor)
         end) do
      {:ok, {deleted, article}} ->
        _ = Indexer.enqueue_metrics(article)
        {:ok, deleted}

      other ->
        other
    end
  end

  defp delete_locked(%{is_archived: true}, _actor),
    do: {:error, ErrorCat.archived("comment is archived, can not be edit or delete")}

  defp delete_locked(%Comment{} = comment, actor) do
    operation_ref = Ecto.UUID.generate()
    occurred_at = DateTime.utc_now(:second)

    with {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, _} <- revoke_if_current(article, comment, actor, operation_ref, occurred_at),
         {:ok, _} <- ORM.dec(article, :comments_count),
         {:ok, _} <- ORM.findby_delete(PinnedComment, %{comment_id: comment.id}),
         {:ok, _} <- Lifecycle.transition(comment.id, :deleted),
         {:ok, deleted} <- ORM.update(comment, %{body_html: @delete_hint}) do
      {:ok, {deleted, article}}
    end
  end

  defp revoke_if_current(%Post{} = post, comment, actor, operation_ref, occurred_at),
    do: SolutionTransition.revoke_if_current(post, comment, actor, operation_ref, occurred_at)

  defp revoke_if_current(_article, _comment, _actor, _operation_ref, _occurred_at),
    do: {:ok, :unchanged}
end
