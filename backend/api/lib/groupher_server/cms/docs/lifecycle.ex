defmodule GroupherServer.CMS.Docs.Lifecycle do
  @moduledoc """
  Branch-scoped lifecycle commands for Docs.

  Docs branch state -> validated transition -> DocLifecycle persistence -> read/write capability
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat
  alias CMS.Model.{DocBranch, DocLifecycle, DocPublic}
  alias CMS.ReviewBlocks

  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @public_readable_states [:published, :archived]
  @allowed_transitions %{
    draft_only: [:draft_only, :published, :deleted, :destroy],
    published: [:published, :archived, :deleted, :destroy],
    archived: [:archived, :deleted, :destroy],
    deleted: [:draft_only, :published, :deleted, :destroy],
    destroy: [:destroy]
  }

  @doc "Returns all supported Docs lifecycle states."
  def states, do: @states

  @doc "Returns the states visible through public reads."
  def public_readable_states, do: @public_readable_states

  @doc "Reads the branch lifecycle state for one stable Doc Article."
  def state(article_id, branch_id) when is_binary(article_id) and is_integer(branch_id) do
    case Repo.get_by(DocLifecycle, article_id: article_id, branch_id: branch_id) do
      %DocLifecycle{state: state} -> {:ok, state}
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  @doc "Transitions one stable Doc Article lifecycle inside a branch."
  def transition(article_id, branch_id, state)
      when is_binary(article_id) and is_integer(branch_id) and state in @states do
    Repo.transaction(fn ->
      lifecycle =
        DocLifecycle
        |> where([row], row.article_id == ^article_id and row.branch_id == ^branch_id)
        |> lock("FOR UPDATE")
        |> Repo.one()

      case lifecycle do
        %DocLifecycle{} = lifecycle ->
          case transition(lifecycle, state) do
            {:ok, updated} -> updated
            {:error, reason} -> Repo.rollback(reason)
          end

        nil ->
          Repo.rollback(ErrorCat.lifecycle_not_found())
      end
    end)
    |> case do
      {:ok, updated} -> {:ok, updated}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Applies an allowed transition to an already-loaded branch Lifecycle row.

  This overload does not acquire the row lock. Call it only inside the owning
  transaction after the caller has loaded/locked the lifecycle, or use the
  article/branch ID overload to load it under `FOR UPDATE`.

  ## Examples

      Docs.Lifecycle.transition(locked_lifecycle, :published)
  """
  @spec transition(DocLifecycle.t(), atom()) ::
          {:ok, DocLifecycle.t()} | {:error, Error.error() | Ecto.Changeset.t()}
  def transition(%DocLifecycle{} = lifecycle, state) when state in @states do
    if state in Map.fetch!(@allowed_transitions, lifecycle.state) do
      now = DateTime.utc_now(:second)

      with {:ok, updated} <-
             lifecycle
             |> DocLifecycle.changeset(%{
               state: state,
               version: lifecycle.version + 1,
               changed_at: now,
               archived_at: state_time(state, :archived, now, lifecycle.archived_at),
               deleted_at: state_time(state, :deleted, now, lifecycle.deleted_at),
               destroyed_at: state_time(state, :destroy, now, lifecycle.destroyed_at)
             })
             |> Repo.update(),
           {:ok, :pass} <- ReviewBlocks.recompute(updated) do
        {:ok, updated}
      end
    else
      {:error, ErrorCat.lifecycle_state_conflict()}
    end
  end

  @doc """
  Applies a platform review restriction to a locked Doc branch lifecycle.

  ## Examples

      Docs.Lifecycle.apply_review_block(locked_lifecycle, attrs)
  """
  @spec apply_review_block(DocLifecycle.t(), map()) :: {:ok, struct()} | {:error, term()}
  def apply_review_block(%DocLifecycle{} = lifecycle, attrs) do
    ReviewBlocks.apply(lifecycle, attrs)
  end

  @doc """
  Ends selected active restrictions on one Doc branch and updates its public projection.

  ## Examples

      Docs.Lifecycle.end_review_blocks(lifecycle, "platform", ids, operation_ref, reason)
  """
  @spec end_review_blocks(DocLifecycle.t(), String.t(), [term()], Ecto.UUID.t(), String.t()) ::
          {:ok, :pass} | {:error, term()}
  def end_review_blocks(%DocLifecycle{} = lifecycle, scope_key, ids, operation_ref, reason) do
    ReviewBlocks.end_blocks(lifecycle, scope_key, ids, operation_ref, reason)
  end

  @doc "Archives stable public Docs older than the threshold in one active branch."
  @spec archive_before(DocBranch.t(), DateTime.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def archive_before(%DocBranch{} = branch, threshold) do
    Repo.transaction(fn ->
      lifecycles =
        DocLifecycle
        |> join(:inner, [lifecycle], public in DocPublic,
          on:
            public.article_id == lifecycle.article_id and
              public.branch_id == lifecycle.branch_id
        )
        |> where([lifecycle, public], lifecycle.branch_id == ^branch.id)
        |> where([lifecycle, _public], lifecycle.state == :published)
        |> where([_lifecycle, public], public.inserted_at < ^threshold)
        |> select([lifecycle, _public], lifecycle)
        |> lock("FOR UPDATE")
        |> Repo.all()

      Enum.reduce(lifecycles, 0, fn lifecycle, count ->
        case transition(lifecycle, :archived) do
          {:ok, _} -> count + 1
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
  end

  defp state_time(state, state, now, _current), do: now
  defp state_time(_state, _target, _now, current), do: current
end
