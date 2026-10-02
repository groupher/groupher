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

  alias GroupherServer.{Accounts, Analysis, CMS}

  alias Accounts.Model.User
  alias CMS.{Command, FrontDesk, Gate}
  alias CMS.Comments.{Lifecycle, ErrorCat, Solution}
  alias CMS.Model.{Article, Comment, PinnedComment}
  alias Analysis.MetricEvent
  alias Helper.{ORM, T}

  @delete_hint Comment.delete_hint()

  @type result :: %{comment: Comment.t(), article: struct(), command_id: String.t()}

  @doc """
  Soft-deletes one authorized Comment without leaving a live solution relation.

  ## Examples

      DeleteComment.execute(comment, actor)
      #=> {:ok, %{comment: %Comment{}, article: article, command_id: id}} | {:error, reason}
  """
  @spec execute(Comment.t(), User.t()) :: T.domain_res(result())
  def execute(%Comment{} = comment, %User{} = actor),
    do: execute(comment, actor, nil)

  @doc "Deletes a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), User.t(), String.t() | nil) :: T.domain_res(result())
  def execute(%Comment{} = comment, %User{} = actor, nil) do
    operation_id = Ecto.UUID.generate()

    Gate.Access.with_check(actor, :delete, comment, fn canonical, article ->
      delete_new(canonical, article, actor, operation_id)
    end)
  end

  def execute(%Comment{} = comment, %User{} = actor, command_id) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :comment_delete,
      target: comment,
      params: %{}
    }

    Command.execute(command,
      action: &delete_action/1,
      result: &delete_result(&1, comment.id)
    )
  end

  defp delete_action(%{actor: actor, target: comment, command_id: command_id}) do
    Gate.Access.with_check(actor, :delete, comment, fn canonical, article ->
      delete_new(canonical, article, actor, command_id)
    end)
  end

  defp delete_result(receipt, comment_id) do
    with {:ok, current} <- ORM.find(Comment, comment_id),
         {:ok, article} <- FrontDesk.article_of(current) do
      {:ok, %{comment: current, article: article, command_id: receipt.command_id}}
    end
  end

  defp delete_new(%Comment{} = comment, article, actor, command_id) do
    occurred_at = DateTime.utc_now(:second)

    with :ok <- ensure_not_archived(comment),
         {:ok, result} <- delete_new(comment, actor, article, command_id, occurred_at) do
      {:ok, result}
    end
  end

  defp delete_new(comment, actor, article, command_id, occurred_at) do
    operation_ref = Ecto.UUID.generate()

    with {:ok, _} <- revoke_if_current(article, comment, actor, operation_ref, occurred_at),
         {:ok, _} <- ORM.findby_delete(PinnedComment, %{comment_id: comment.id}),
         {:ok, _} <- Lifecycle.transition(comment.id, :deleted),
         {:ok, deleted} <- ORM.update(comment, %{body_html: @delete_hint}),
         :ok <- CMS.ArticleStats.record_comment_change(article),
         :ok <- record_article_metric(article, command_id, :comment_deleted),
         {:ok, _invalidation} <-
           invalidate_public_comments(article, comment.thread, command_id),
         :ok <- enqueue_delete_effects(comment, article, actor, command_id) do
      {:ok, %{comment: deleted, article: article, command_id: command_id}}
    end
  end

  defp ensure_not_archived(comment) do
    if Map.get(comment, :is_archived) == true,
      do: {:error, ErrorCat.archived("comment is archived, can not be edit or delete")},
      else: :ok
  end

  defp revoke_if_current(
         %Article{thread: :post} = post,
         comment,
         actor,
         operation_ref,
         occurred_at
       ),
       do: Solution.revoke_if_current(post, comment, actor, operation_ref, occurred_at)

  defp revoke_if_current(_article, _comment, _actor, _operation_ref, _occurred_at),
    do: {:ok, :unchanged}

  defp record_article_metric(article, operation_id, metric) do
    case MetricEvent.append_article_action(article, operation_id, metric) do
      :ok -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, thread, command_id) do
    {:ok, article} = CMS.Articles.Reader.with_community(article)

    CMS.Outbox.send(%{
      event: "comment.changed",
      worker: CMS.Outbox.Workers.Comment.Cleanup,
      resource_type: "article",
      resource_id: article.id,
      command_id: command_id,
      data: %{
        community: article.community.slug,
        community_id: article.community_id,
        thread: thread,
        inner_id: article.inner_id,
        article_id: article.id
      }
    })
  end

  defp enqueue_delete_effects(comment, article, actor, command_id) do
    case CMS.Outbox.send(%{
           event: "comment.deleted",
           worker: CMS.Outbox.Workers.Comment.Cleanup,
           resource_type: "article",
           resource_id: article.id,
           command_id: command_id,
           data: %{actor_id: actor.id, article_id: article.id, comment_id: comment.id}
         }) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
