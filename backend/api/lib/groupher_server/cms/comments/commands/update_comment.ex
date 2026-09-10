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

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Jobs
  alias GroupherServer.CMS.{FrontDesk, Gate}
  alias GroupherServer.CMS.Comments.{BodyCodec, JobPolicy}
  alias GroupherServer.CMS.CommandReceipt
  alias GroupherServer.CMS.Model.Comment
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

  @spec execute(Comment.t(), String.t(), User.t(), String.t() | nil) :: T.domain_res(Comment.t())
  @doc "Updates a Comment while binding retries to the supplied command key."
  def execute(%Comment{} = comment, body, %User{} = actor, command_key) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(command_key) do
      CommandReceipt.run_user_command(
        actor,
        command_key,
        "comment.update",
        "comment",
        comment.id,
        body,
        fn ->
          Gate.Access.with_check(actor, :edit, comment, fn canonical ->
            update_new(canonical, body, command_key)
          end)
        end,
        fn _receipt ->
          with {:ok, article} <- FrontDesk.article_of(comment) do
            {:ok,
             comment
             |> Map.put(:article, article_summary(article, comment.thread))
             |> Map.put(:command_key, command_key)
             |> Map.put(:command_replayed, true)}
          end
        end
      )
      |> enqueue_mentions()
    end
  end

  defp update_new(canonical, body, command_key) do
    with {:ok, payload} <- BodyCodec.parse(body),
         {:ok, updated} <-
           ORM.update(canonical, %{body: payload.json, body_html: payload.html}),
         {:ok, article} <- FrontDesk.article_of(canonical),
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
       |> Map.put(:command_key, command_key)
       |> Map.put(:command_replayed, false)}
    end
  end

  defp enqueue_mentions({:ok, %Comment{} = comment} = result) do
    if Map.get(comment, :command_replayed, false) do
      result
    else
      enqueue_mentions_for(comment, result)
    end
  end

  defp enqueue_mentions(result), do: result

  defp enqueue_mentions_for(%Comment{} = comment, result) do
    :ok =
      Jobs.enqueue_best_effort(:sync_mentions, comment.id, fn ->
        Jobs.sync_mentions(comment)
      end)

    result
  end

  defp article_summary(article, thread) do
    %{
      thread: thread,
      inner_id: article.inner_id,
      comments_count: article.comments_count,
      comments_revision: article.comments_revision
    }
  end
end
