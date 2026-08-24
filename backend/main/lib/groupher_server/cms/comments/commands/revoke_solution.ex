defmodule GroupherServer.CMS.Comments.Commands.RevokeSolution do
  @moduledoc """
  Revokes the authoritative solution relation of one QA Post.

      public comment id
        -> Gate authorization + Post aggregate transaction/lock
        -> verify target is current solution
        -> delete PostSolution + write Activity

  A Post with no current solution is an idempotent, side-effect-free success.
  A different Comment on the same Post is rejected as a target mismatch.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.{FrontDesk, Gate}
  alias GroupherServer.CMS.Comments.Commands.SolutionTransition
  alias GroupherServer.CMS.Model.{Comment, Post}
  alias Helper.T

  @doc """
  Revokes a Comment only when it is its Post's current solution.

  ## Examples

      RevokeSolution.execute(comment_id, post_author)
      #=> {:ok, %Comment{is_solution: false}} | {:error, reason}
  """
  @spec execute(T.id(), User.t()) :: T.domain_res(Comment.t())
  def execute(comment_id, %User{} = actor) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      Gate.Access.with_check(actor, :revoke_solution, comment, fn canonical ->
        with {:ok, post} <- FrontDesk.get(Post, canonical.post_id) do
          SolutionTransition.revoke(post, canonical, actor)
        end
      end)
    end
  end
end
