defmodule GroupherServer.CMS.Comments.Commands.Solution do
  @moduledoc """
  Runs the complete solution command family for one QA Post.

      resolved Comment
        -> Gate authorization + Post aggregate transaction/lock
        -> accept | replace | revoke
        -> PostSolution relation + Activity

  The module intentionally groups the closely related accept/revoke actions.
  `revoke_if_current/5` is the narrow reconciliation entry used by the
  Comment delete command; it is not a separate public command family.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Gate
  alias CMS.Comments.ErrorCat
  alias CMS.Model.{Comment, Post, PostSolution}

  @doc """
  Accepts or replaces the current solution of a QA Post.

  ## Examples

      Commands.Solution.accept(comment, actor)
  """
  @spec accept(Comment.t(), User.t()) :: {:ok, Comment.t()} | {:error, term()}
  def accept(%Comment{} = comment, %User{} = actor) do
    Gate.Access.with_check(actor, :accept_solution, comment, fn canonical, post ->
      accept_in_transaction(post, canonical, actor)
    end)
  end

  @doc """
  Revokes a Comment only when it is the current solution of its QA Post.

  ## Examples

      Commands.Solution.revoke(comment, actor)
  """
  @spec revoke(Comment.t(), User.t()) :: {:ok, Comment.t()} | {:error, term()}
  def revoke(%Comment{} = comment, %User{} = actor) do
    Gate.Access.with_check(actor, :revoke_solution, comment, fn canonical, post ->
      revoke_in_transaction(post, canonical, actor)
    end)
  end

  @doc "Locks and returns the current solution relation for a Post."
  @spec current(Post.t()) :: PostSolution.t() | nil
  def current(%Post{id: post_id}) do
    PostSolution
    |> where([solution], solution.post_id == ^post_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc "Revokes a relation only when it points to the supplied Comment."
  @spec revoke_if_current(Post.t(), Comment.t(), User.t(), Ecto.UUID.t(), DateTime.t()) ::
          {:ok, :unchanged | :revoked} | {:error, term()}
  def revoke_if_current(
        %Post{} = post,
        %Comment{} = comment,
        %User{} = actor,
        operation_ref,
        occurred_at
      ) do
    case current(post) do
      %PostSolution{comment_id: comment_id} = solution when comment_id == comment.id ->
        with {:ok, _} <- Repo.delete(solution),
             {:ok, _} <-
               Activity.log(post, :solution_revoked,
                 actor: actor,
                 target: comment,
                 operation_ref: operation_ref,
                 occurred_at: occurred_at,
                 payload: %{}
               ) do
          {:ok, :revoked}
        end

      _ ->
        {:ok, :unchanged}
    end
  end

  defp accept_in_transaction(%Post{} = post, %Comment{} = comment, %User{} = actor) do
    current = current(post)

    if match?(%PostSolution{comment_id: id} when id == comment.id, current) do
      {:ok, %{comment | is_solution: true}}
    else
      operation_ref = Ecto.UUID.generate()
      occurred_at = DateTime.utc_now(:second)

      with {:ok, _solution} <- upsert(current, post, comment, actor, occurred_at),
           {:ok, _activity} <-
             record_accept(current, post, comment, actor, operation_ref, occurred_at) do
        {:ok, %{comment | is_solution: true}}
      end
    end
  end

  defp revoke_in_transaction(%Post{} = post, %Comment{} = comment, %User{} = actor) do
    case current(post) do
      nil ->
        {:ok, %{comment | is_solution: false}}

      %PostSolution{comment_id: comment_id} when comment_id != comment.id ->
        {:error,
         ErrorCat.solution_target_mismatch(%{
           requested_comment_ref: public_ref(comment),
           current_comment_ref: current_comment_ref(comment_id)
         })}

      %PostSolution{} = solution ->
        operation_ref = Ecto.UUID.generate()
        occurred_at = DateTime.utc_now(:second)

        with {:ok, _} <- Repo.delete(solution),
             {:ok, _} <-
               Activity.log(post, :solution_revoked,
                 actor: actor,
                 target: comment,
                 operation_ref: operation_ref,
                 occurred_at: occurred_at,
                 payload: %{}
               ) do
          {:ok, %{comment | is_solution: false}}
        end
    end
  end

  defp upsert(nil, post, comment, actor, occurred_at) do
    %PostSolution{}
    |> PostSolution.changeset(%{
      post_id: post.id,
      comment_id: comment.id,
      accepted_by_id: actor.id,
      accepted_at: occurred_at
    })
    |> Repo.insert()
  end

  defp upsert(solution, _post, comment, actor, occurred_at) do
    solution
    |> PostSolution.changeset(%{
      comment_id: comment.id,
      accepted_by_id: actor.id,
      accepted_at: occurred_at
    })
    |> Repo.update()
  end

  defp record_accept(current, post, comment, actor, operation_ref, occurred_at) do
    {action, payload} =
      case current do
        nil ->
          {:solution_accepted, %{}}

        %PostSolution{comment_id: previous_id} ->
          {:solution_replaced, %{previous_comment_ref: current_comment_ref(previous_id)}}
      end

    Activity.log(post, action,
      actor: actor,
      target: comment,
      operation_ref: operation_ref,
      occurred_at: occurred_at,
      payload: payload
    )
  end

  defp current_comment_ref(comment_id) do
    case Repo.get(Comment, comment_id) do
      nil -> to_string(comment_id)
      comment -> public_ref(comment)
    end
  end

  defp public_ref(%Comment{inner_id: inner_id, id: id}), do: to_string(inner_id || id)
end
