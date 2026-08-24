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
  def execute(%Comment{} = comment, body, %User{} = actor) do
    Gate.Access.with_check(actor, :edit, comment, fn canonical ->
      with {:ok, payload} <- BodyCodec.parse(body),
           {:ok, updated} <-
             ORM.update(canonical, %{body: payload.json, body_html: payload.html}),
           {:ok, synced} <- FrontDesk.sync_embed_replies(updated),
           {:ok, _} <- JobPolicy.audition(synced) do
        {:ok, synced}
      end
    end)
    |> enqueue_mentions()
  end

  defp enqueue_mentions({:ok, %Comment{} = comment} = result) do
    :ok =
      Jobs.enqueue_best_effort(:sync_mentions, comment.id, fn ->
        Jobs.sync_mentions(comment)
      end)

    result
  end

  defp enqueue_mentions(result), do: result
end
