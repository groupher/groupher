defmodule GroupherServer.CMS.Assets.Workflow do
  @moduledoc """
  Shared durable run/step protocol for non-user Asset workflows.

  Workflow identity is deliberately separate from `CMS.Command` identity. The
  helper owns only row creation, claim/lease and recovery state; the caller owns
  its domain transaction and external effect semantics.

  A run may remain `:pending` after an intentional subset apply releases its
  lease. Handled failures are marked `:failed` and release the lease immediately;
  an actual worker crash leaves the lease for expiry-based recovery.

      maintenance trigger
        -> durable workflow run
        -> claimed workflow step
        -> domain transaction / external effect
        -> replayable step result
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{AssetWorkflowRun, AssetWorkflowStep}

  @lease_seconds 120

  @doc "Creates or loads one stable workflow run."
  def ensure_run(attrs) when is_map(attrs) do
    changeset = AssetWorkflowRun.changeset(%AssetWorkflowRun{}, attrs)

    case Repo.insert(changeset, on_conflict: :nothing, conflict_target: :workflow_ref) do
      {:ok, %AssetWorkflowRun{id: nil}} ->
        {:ok, Repo.get_by!(AssetWorkflowRun, workflow_ref: attrs.workflow_ref)}

      {:ok, %AssetWorkflowRun{} = run} ->
        {:ok, run}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Creates or loads one stable step within a run."
  def ensure_step(%AssetWorkflowRun{id: run_id}, attrs) when is_map(attrs) do
    attrs = Map.put(attrs, :run_id, run_id)
    changeset = AssetWorkflowStep.changeset(%AssetWorkflowStep{}, attrs)

    case Repo.insert(changeset,
           on_conflict: :nothing,
           conflict_target: [:run_id, :step_ref]
         ) do
      {:ok, %AssetWorkflowStep{id: nil}} ->
        {:ok, Repo.get_by!(AssetWorkflowStep, run_id: run_id, step_ref: attrs.step_ref)}

      {:ok, %AssetWorkflowStep{} = step} ->
        {:ok, step}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Claims a run with a lease; expired leases are recoverable."
  def claim_run(%AssetWorkflowRun{} = run, owner, opts \\ [])
      when is_binary(owner) and owner != "" do
    lease_seconds = Keyword.get(opts, :lease_seconds, @lease_seconds)
    now = DateTime.utc_now(:second)
    run_id = run.id

    Repo.transaction(fn ->
      run = Repo.one!(from(row in AssetWorkflowRun, where: row.id == ^run_id, lock: "FOR UPDATE"))

      if run.status == :completed do
        {:completed, run}
      else
        if is_struct(run.lease_expires_at, DateTime) and
             DateTime.compare(run.lease_expires_at, now) == :gt do
          {:busy, max(DateTime.diff(run.lease_expires_at, now, :second), 1)}
        else
          {:ok,
           run
           |> AssetWorkflowRun.changeset(%{
             status: :running,
             locked_by: owner,
             lease_expires_at: DateTime.add(now, lease_seconds, :second),
             started_at: run.started_at || now,
             last_error: nil
           })
           |> Repo.update!()}
        end
      end
    end)
    |> unwrap_transaction()
  end

  @doc "Claims one pending, failed, or lease-expired step."
  def claim_step(step, owner, opts \\ [])

  def claim_step(nil, _owner, _opts), do: {:error, :workflow_step_not_found}

  def claim_step(%AssetWorkflowStep{} = step, owner, opts)
      when is_binary(owner) and owner != "" do
    lease_seconds = Keyword.get(opts, :lease_seconds, @lease_seconds)
    now = DateTime.utc_now(:second)
    step_id = step.id

    Repo.transaction(fn ->
      step =
        Repo.one!(from(row in AssetWorkflowStep, where: row.id == ^step_id, lock: "FOR UPDATE"))

      cond do
        step.status in [:succeeded, :skipped] ->
          {:completed, step}

        step.status == :claimed and not lease_expired?(step, now) ->
          {:busy, max(DateTime.diff(step.lease_expires_at, now, :second), 1)}

        true ->
          {:ok,
           step
           |> AssetWorkflowStep.changeset(%{
             status: :claimed,
             attempts: step.attempts + 1,
             locked_by: owner,
             lease_expires_at: DateTime.add(now, lease_seconds, :second),
             last_error: nil
           })
           |> Repo.update!()}
      end
    end)
    |> unwrap_transaction()
  end

  @doc "Marks a claimed step successful and stores its replay result."
  def complete_step(%AssetWorkflowStep{id: id}, owner, result) do
    now = DateTime.utc_now(:second)

    case Repo.update_all(
           from(step in AssetWorkflowStep,
             where: step.id == ^id and step.status == :claimed and step.locked_by == ^owner
           ),
           set: [
             status: :succeeded,
             result: result,
             locked_by: nil,
             lease_expires_at: nil,
             updated_at: now
           ]
         ) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :workflow_step_stale_lease}
    end
  end

  @doc "Marks a claimed step intentionally skipped and stores its durable reason."
  def skip_step(%AssetWorkflowStep{id: id}, owner, result) do
    now = DateTime.utc_now(:second)

    case Repo.update_all(
           from(step in AssetWorkflowStep,
             where: step.id == ^id and step.status == :claimed and step.locked_by == ^owner
           ),
           set: [
             status: :skipped,
             result: result,
             locked_by: nil,
             lease_expires_at: nil,
             updated_at: now
           ]
         ) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :workflow_step_stale_lease}
    end
  end

  @doc "Releases a claimed step back to pending without recording success or failure."
  def release_step(%AssetWorkflowStep{id: id}, owner) do
    now = DateTime.utc_now(:second)

    case Repo.update_all(
           from(step in AssetWorkflowStep,
             where: step.id == ^id and step.status == :claimed and step.locked_by == ^owner
           ),
           set: [status: :pending, locked_by: nil, lease_expires_at: nil, updated_at: now]
         ) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :workflow_step_stale_lease}
    end
  end

  @doc "Marks a claimed step failed or conflicted while releasing its lease."
  def fail_step(%AssetWorkflowStep{id: id}, owner, reason, status \\ :failed) do
    now = DateTime.utc_now(:second)

    case Repo.update_all(
           from(step in AssetWorkflowStep,
             where: step.id == ^id and step.status == :claimed and step.locked_by == ^owner
           ),
           set: [
             status: status,
             last_error: inspect(reason),
             locked_by: nil,
             lease_expires_at: nil,
             updated_at: now
           ]
         ) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :workflow_step_stale_lease}
    end
  end

  @doc "Marks a handled run failure and releases the current owner lease."
  def fail_run(%AssetWorkflowRun{id: id}, owner, reason)
      when is_binary(owner) and owner != "" do
    now = DateTime.utc_now(:second)

    case Repo.update_all(
           from(run in AssetWorkflowRun,
             where: run.id == ^id and run.status == :running and run.locked_by == ^owner
           ),
           set: [
             status: :failed,
             last_error: inspect(reason),
             locked_by: nil,
             lease_expires_at: nil,
             completed_at: nil,
             updated_at: now
           ]
         ) do
      {1, _} -> {:ok, Repo.get!(AssetWorkflowRun, id)}
      _ -> {:error, :workflow_run_stale_lease}
    end
  end

  @doc "Completes or releases a run after its current steps have reached a terminal state."
  def finish_run(%AssetWorkflowRun{locked_by: owner} = run, owner) do
    finish_run_locked(run)
  end

  def finish_run(%AssetWorkflowRun{}, _owner), do: {:error, :workflow_run_stale_lease}

  defp finish_run_locked(%AssetWorkflowRun{id: id} = run) do
    steps = Repo.all(from(step in AssetWorkflowStep, where: step.run_id == ^id))

    status =
      cond do
        Enum.all?(steps, &terminal_step?/1) -> :completed
        Enum.any?(steps, &failed_step?/1) -> :failed
        true -> :pending
      end

    now = DateTime.utc_now(:second)

    run
    |> AssetWorkflowRun.changeset(%{
      status: status,
      locked_by: nil,
      lease_expires_at: nil,
      completed_at: if(status == :completed, do: now, else: nil),
      last_error: if(status == :failed, do: "workflow has incomplete steps", else: nil)
    })
    |> Repo.update()
    |> case do
      {:ok, run} -> {:ok, run}
      {:error, reason} -> {:error, reason}
    end
  end

  defp terminal_step?(%AssetWorkflowStep{status: status}), do: status in [:succeeded, :skipped]

  defp failed_step?(%AssetWorkflowStep{status: status}), do: status in [:failed, :conflict]

  defp lease_expired?(%AssetWorkflowStep{lease_expires_at: nil}, _now), do: true

  defp lease_expired?(%AssetWorkflowStep{lease_expires_at: expires_at}, now) do
    DateTime.compare(expires_at, now) != :gt
  end

  defp unwrap_transaction({:ok, result}), do: result
  defp unwrap_transaction({:error, reason}), do: {:error, reason}
end
