defmodule GroupherServer.CMS.Comments.Commands.UpdateComment do
  @moduledoc """
  Updates Comment content inside its parent Article aggregate boundary.

      target Comment
        -> Gate authorization + aggregate transaction/lock
        -> parse body -> update canonical Comment -> sync embedded replies
        -> enqueue required audition job -> commit
        -> enqueue best-effort mention reconciliation

  Solution identity is never inferred from a Comment flag. Read-side Query
  code derives it from `PostSolution`; the Comment row remains the body
  authority.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.{Command, FrontDesk, Gate, Comments}
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
  alias Comments.{BodyCodec, JobPolicy}
  alias CMS.Model.Comment
  alias Helper.{ORM, T}

  @type result :: %{comment: Comment.t(), article: struct(), command_id: String.t() | nil}

  @doc """
  Updates the authorized canonical Comment, requires audition enqueue before
  commit, then schedules mention reconciliation without changing the result.

  ## Examples

      UpdateComment.execute(comment, body, actor)
      #=> {:ok, %{comment: %Comment{}, article: article, command_id: id}} | {:error, reason}
  """
  @spec execute(Comment.t(), String.t(), User.t()) :: T.domain_res(result())
  def execute(%Comment{} = comment, body, %User{} = actor) do
    execute(comment, body, actor, nil)
  end

  @doc "Updates a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), String.t(), User.t(), String.t() | nil) :: T.domain_res(result())
  def execute(%Comment{} = comment, body, %User{} = actor, nil) do
    operation_id = Ecto.UUID.generate()

    Gate.Access.with_check(actor, :edit, comment, fn canonical, article ->
      update_new(canonical, article, body, actor, operation_id)
    end)
  end

  def execute(%Comment{} = comment, body, %User{} = actor, command_id) do
    command = %Command{
      actor: actor,
      command_id: command_id,
      operation: :comment_update,
      target: comment,
      params: body
    }

    with {:ok, confirmation} <-
           Command.execute(command, action: &update_action/1, confirmation: Confirmation) do
      update_result(confirmation, comment.id)
    end
  end

  defp update_action(%{
         actor: actor,
         target: comment,
         params: body,
         command_id: command_id
       }) do
    Gate.Access.with_check(actor, :edit, comment, fn canonical, article ->
      with {:ok, result} <- update_new(canonical, article, body, actor, command_id) do
        {:ok, confirmation(result)}
      end
    end)
  end

  defp update_result(%Confirmation{data: data}, comment_id) do
    update_result(%{command_id: data["command_id"]}, comment_id)
  end

  defp update_result(receipt, comment_id) do
    with {:ok, current} <- ORM.find(Comment, comment_id),
         {:ok, article} <- FrontDesk.article_of(current) do
      {:ok, %{comment: current, article: article, command_id: receipt.command_id}}
    end
  end

  defp update_new(canonical, article, body, actor, command_id) do
    with {:ok, payload} <- BodyCodec.parse(body),
         {:ok, updated} <-
           ORM.update(canonical, %{body: payload.json, body_html: payload.html}),
         :ok <- CMS.ArticleStats.record_comment_change(article),
         {:ok, synced} <- CMS.Comments.Replies.sync_embed_replies(updated),
         {:ok, _} <- JobPolicy.audition(synced),
         {:ok, _invalidation} <- invalidate_public_comments(article, canonical.thread, command_id),
         :ok <- enqueue_comment_effects(canonical, actor, command_id) do
      {:ok, %{comment: synced, article: article, command_id: command_id}}
    end
  end

  defp confirmation(%{comment: comment, article: article, command_id: command_id}) do
    %Confirmation{
      data: %{
        "comment_id" => to_string(comment.id),
        "article_id" => to_string(article.id),
        "command_id" => command_id
      }
    }
  end

  defp invalidate_public_comments(article, thread, command_id) do
    {:ok, article} = CMS.Articles.Store.with_community(article)

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

  defp enqueue_comment_effects(%Comment{} = comment, %User{} = actor, command_id) do
    case CMS.Outbox.send(%{
           event: "comment.updated",
           worker: CMS.Outbox.Workers.Comment.Cleanup,
           resource_type: "comment",
           resource_id: comment.id,
           command_id: command_id,
           data: %{actor_id: actor.id, article_id: comment.article_id}
         }) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
