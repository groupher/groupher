defmodule GroupherServer.CMS.Comments.Commands.UpdateComment do
  @moduledoc """
  Updates Comment content inside its parent Article aggregate boundary.

      target Comment
        -> Gate authorization + aggregate transaction/lock
        -> parse body -> update canonical Comment -> sync embedded replies
        -> enqueue required audition job -> commit
        -> enqueue best-effort mention reconciliation

  Solution identity is never inferred from a Comment flag. Readers derive it
  from `PostSolution`; the Comment row remains the body authority.
  """

  alias GroupherServer.{Accounts, CMS, Jobs}

  alias Accounts.Model.User
  alias CMS.{Command, FrontDesk, Gate, Comments}
  alias Comments.{BodyCodec, JobPolicy}
  alias CMS.Model.Comment

  alias Helper.{ORM, T}

  @doc """
  Updates the authorized canonical Comment, requires audition enqueue before
  commit, then schedules mention reconciliation without changing the result.

  ## Examples

      UpdateComment.execute(comment, body, actor)
      #=> {:ok, %Comment{}} | {:error, reason}
  """
  @spec execute(Comment.t(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def execute(%Comment{} = comment, body, %User{} = actor),
    do: execute(comment, body, actor, nil)

  @doc "Updates a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), String.t(), User.t(), String.t() | nil) :: T.domain_res(Comment.t())
  def execute(%Comment{} = comment, body, %User{} = actor, command_id) do
    command =
      Command.update_user(actor, command_id,
        command: :comment_update,
        resource: comment,
        input: body
      )

    Command.run(
      %{
        command
        | after_commit: fn %Comment{} = updated ->
            enqueue_mentions_for(updated)
            :ok
          end
      },
      fn %{
           actor: actor,
           resource: comment,
           input: body,
           command_id: command_id
         } ->
        Gate.Access.with_check(actor, :edit, comment, fn canonical, article ->
          update_new(canonical, article, body, command_id)
        end)
      end
    )
  end

  defp update_new(canonical, article, body, command_id) do
    with {:ok, payload} <- BodyCodec.parse(body),
         {:ok, updated} <-
           ORM.update(canonical, %{body: payload.json, body_html: payload.html}),
         {:ok, updated_article} <- ORM.inc(article, :comments_revision),
         {:ok, synced} <- FrontDesk.sync_embed_replies(updated),
         {:ok, _} <- JobPolicy.audition(synced) do
      {:ok,
       synced
       |> Map.put(:article, %{
         thread: canonical.thread,
         inner_id: article.inner_id,
         comments_count: updated_article.comments_count,
         comments_revision: updated_article.comments_revision
       })
       |> Map.put(:command_id, command_id)}
    end
  end

  defp enqueue_mentions_for(%Comment{} = comment) do
    :ok =
      Jobs.enqueue_best_effort(:sync_mentions, comment.id, fn ->
        Jobs.sync_mentions(comment)
      end)
  end
end
