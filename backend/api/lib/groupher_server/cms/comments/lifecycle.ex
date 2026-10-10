defmodule GroupherServer.CMS.Comments.Lifecycle do
  @moduledoc """
  Lifecycle authority for one Comment.

  Business position:

      CMS comment command
        -> Comment Lifecycle
        -> Repo / state transition
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Comments.ErrorCat
  alias CMS.Model.CommentLifecycle

  @states [:visible, :deleted, :destroy]
  @allowed_transitions %{
    visible: [:visible, :deleted, :destroy],
    deleted: [:deleted, :destroy],
    destroy: [:destroy]
  }

  @doc """
  Returns the current lifecycle state for one comment.

  ## Examples

      CMS.Comments.Lifecycle.state(comment_id)

  """
  @spec state(integer()) ::
          {:ok, CommentLifecycle.state()} | {:error, ErrorCat.error()}
  def state(comment_id) do
    case Repo.get_by(CommentLifecycle, comment_id: comment_id) do
      %CommentLifecycle{state: state} -> {:ok, state}
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  @doc """
  Creates the initial visible Lifecycle row for a newly inserted Comment.

  This primitive is called inside the owning Comment command transaction.

  ## Examples

      Comments.Lifecycle.ensure_created(comment.id)
  """
  @spec ensure_created(integer()) :: {:ok, CommentLifecycle.t()} | {:error, term()}
  def ensure_created(comment_id) when is_integer(comment_id) do
    %CommentLifecycle{}
    |> CommentLifecycle.changeset(%{
      comment_id: comment_id,
      state: :visible,
      version: 1,
      changed_at: DateTime.utc_now(:second)
    })
    |> Repo.insert()
  end

  @doc """
  Locks and transitions an existing Comment Lifecycle row. When passed an
  already locked `CommentLifecycle` struct, it performs only the transition.

  This is a command-internal primitive, not a standalone delete or destroy
  business operation. Callers that change Comment visibility must reconcile
  parent aggregate bindings before invoking it.

  ## Examples

      Comments.Lifecycle.transition(comment.id, :deleted)
      Comments.Lifecycle.transition(locked_lifecycle, :deleted)
  """
  @spec transition(integer(), CommentLifecycle.state()) ::
          {:ok, CommentLifecycle.t()}
          | {:error, ErrorCat.error() | Ecto.Changeset.t()}
  def transition(comment_id, state) when is_integer(comment_id) and state in @states do
    lifecycle =
      CommentLifecycle
      |> where([lifecycle], lifecycle.comment_id == ^comment_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case lifecycle do
      nil ->
        {:error, ErrorCat.lifecycle_not_found()}

      %CommentLifecycle{} = lifecycle ->
        transition(lifecycle, state)
    end
  end

  @spec transition(CommentLifecycle.t(), CommentLifecycle.state()) ::
          {:ok, CommentLifecycle.t()} | {:error, Ecto.Changeset.t() | :lifecycle_state_conflict}
  def transition(%CommentLifecycle{} = lifecycle, state) when state in @states do
    if state in Map.fetch!(@allowed_transitions, lifecycle.state) do
      now = DateTime.utc_now(:second)

      lifecycle
      |> CommentLifecycle.changeset(%{
        state: state,
        version: lifecycle.version + 1,
        changed_at: now,
        deleted_at: state_time(state, :deleted, now, lifecycle.deleted_at),
        destroyed_at: state_time(state, :destroy, now, lifecycle.destroyed_at)
      })
      |> Repo.update()
    else
      {:error, ErrorCat.lifecycle_state_conflict()}
    end
  end

  defp state_time(state, state, now, _current), do: now
  defp state_time(_state, _target, _now, current), do: current
end
