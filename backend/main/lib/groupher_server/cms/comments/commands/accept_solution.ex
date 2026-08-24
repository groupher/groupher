defmodule GroupherServer.CMS.Comments.Commands.AcceptSolution do
  @moduledoc """
  Accepts or replaces the authoritative solution of one QA Post.

      public comment id
        -> load target identity
        -> Gate authorization + Post aggregate transaction/lock
        -> insert/update PostSolution
        -> Activity in the same transaction

  Pin state, Post workflow status, and question projections are deliberately
  outside this command.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.{FrontDesk, Gate}
  alias GroupherServer.CMS.Comments.Commands.SolutionTransition
  alias GroupherServer.CMS.Model.{Comment, Post}
  alias Helper.T

  @doc """
  Accepts a Comment as its QA Post's current solution.

  Repeating the operation for the same Comment is idempotent. Accepting a
  different Comment replaces the relation and records one replacement event.

  ## Examples

      AcceptSolution.execute(comment_id, post_author)
      #=> {:ok, %Comment{is_solution: true}} | {:error, reason}
  """
  @spec execute(T.id(), User.t()) :: T.domain_res(Comment.t())
  def execute(comment_id, %User{} = actor) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      Gate.Access.with_check(actor, :accept_solution, comment, fn canonical ->
        with {:ok, post} <- FrontDesk.get(Post, canonical.post_id) do
          SolutionTransition.accept(post, canonical, actor)
        end
      end)
    end
  end
end
