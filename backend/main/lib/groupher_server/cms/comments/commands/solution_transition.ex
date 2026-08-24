defmodule GroupherServer.CMS.Comments.Commands.SolutionTransition do
  @moduledoc """
  Implements relation transitions shared by solution and delete Commands.

  The caller already owns the Post aggregate transaction and advisory lock.
  This module never opens another boundary or invokes Gate again.

      authorized aggregate callback
        -> lock/read current PostSolution row
        -> accept | replace | revoke | unchanged
        -> write Activity in the same transaction
        -> return to owning Command
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Activity, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Comments.ErrorCat
  alias GroupherServer.CMS.Model.{Comment, Post, PostSolution}

  @doc """
  Locks and returns the current solution relation for a Post.

  The caller must already own the Post aggregate transaction.

  ## Examples

      SolutionTransition.current(post)
      #=> %PostSolution{} | nil
  """
  @spec current(Post.t()) :: PostSolution.t() | nil
  def current(%Post{id: post_id}) do
    PostSolution
    |> where([solution], solution.post_id == ^post_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc """
  Accepts or replaces a Post solution inside the owning transaction.

  ## Examples

      SolutionTransition.accept(post, comment, actor)
      #=> {:ok, %Comment{is_solution: true}} | {:error, reason}
  """
  @spec accept(Post.t(), Comment.t(), User.t()) :: {:ok, Comment.t()} | {:error, term()}
  def accept(%Post{} = post, %Comment{} = comment, %User{} = actor) do
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

  @doc """
  Revokes the requested Comment when it is the Post's current solution.

  A Post without a current relation succeeds without side effects; requesting
  another Comment returns `solution_target_mismatch`.

  ## Examples

      SolutionTransition.revoke(post, comment, actor)
      #=> {:ok, %Comment{is_solution: false}} | {:error, reason}
  """
  @spec revoke(Post.t(), Comment.t(), User.t()) :: {:ok, Comment.t()} | {:error, term()}
  def revoke(%Post{} = post, %Comment{} = comment, %User{} = actor) do
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

  @doc """
  Revokes a relation only when it currently points to the supplied Comment.

  Delete commands pass their own operation reference and timestamp so the
  reconciliation Activity shares the command identity.

  ## Examples

      SolutionTransition.revoke_if_current(post, comment, actor, operation_ref, occurred_at)
      #=> {:ok, :revoked} | {:ok, :unchanged} | {:error, reason}
  """
  @spec revoke_if_current(Post.t(), Comment.t(), User.t(), Ecto.UUID.t(), DateTime.t()) ::
          {:ok, :unchanged | :revoked} | {:error, term()}
  def revoke_if_current(post, comment, actor, operation_ref, occurred_at) do
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
