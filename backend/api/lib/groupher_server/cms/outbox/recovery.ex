defmodule GroupherServer.CMS.Outbox.Recovery do
  @moduledoc """
  Requeues one dead Outbox event under a failure-generation fence.

  Event reset, the one-per-generation retry record, and the Oban wakeup share a
  database transaction. Domain owners perform authorization and freshness
  checks before calling this primitive.

      authorized recovery request -> lock dead event generation
        -> reset + retry fact + Oban wakeup -> commit once
  """

  import Ecto.Query

  alias GroupherServer.{Jobs, Repo}
  alias GroupherServer.CMS.Outbox.{Event, Retry}

  @active_job_states ["available", "scheduled", "retryable", "executing"]

  @doc "Atomically resets and wakes a dead event once for its expected generation."
  def requeue(event_id, expected_generation, operation_ref, worker, initiator)
      when is_binary(event_id) and is_integer(expected_generation) and expected_generation > 0 and
             is_binary(operation_ref) and is_atom(worker) and is_map(initiator) do
    if Jobs.config_skip_enqueue?() do
      {:ok, %{outcome: :skipped, reason: :enqueue_disabled}}
    else
      Repo.transact_result(fn ->
        with {:ok, event} <- lock_event(event_id),
             {:ok, event} <- validate_generation(event, expected_generation) do
          case {event.status, existing_receipt(event)} do
            {_status, {:ok, :existing}} ->
              {:ok, %{outcome: :already_retried, event: event}}

            {:failed, {:ok, :new}} ->
              with {:ok, :pass} <- require_dead(event),
                   {:ok, :pass} <- ensure_no_active_job(event, worker),
                   {:ok, updated} <- reset_event(event),
                   {:ok, _retry} <- record_retry(event, operation_ref, initiator),
                   {:ok, _job} <- insert_job(worker, event.id) do
                {:ok, %{outcome: :requeued, event: updated}}
              end

            {:running, _} ->
              {:error, :outbox_recovery_job_busy}

            {_status, _receipt} ->
              {:error, :outbox_effect_not_dead}
          end
        end
      end)
    end
  end

  def requeue(_event_id, _expected_generation, _operation_ref, _worker, _initiator) do
    {:error, :invalid_outbox_recovery_request}
  end

  defp lock_event(event_id) do
    case Repo.one(from(event in Event, where: event.id == ^event_id, lock: "FOR UPDATE")) do
      %Event{} = event -> {:ok, event}
      nil -> {:error, :outbox_event_not_found}
    end
  end

  defp validate_generation(%Event{failure_generation: generation}, expected)
       when generation != expected do
    {:error, :outbox_recovery_stale_generation}
  end

  defp validate_generation(%Event{} = event, _expected), do: {:ok, event}

  defp require_dead(%Event{status: :failed}), do: {:ok, :pass}

  defp existing_receipt(event) do
    case Repo.get_by(Retry,
           event_id: event.id,
           failure_generation: event.failure_generation
         ) do
      %Retry{} -> {:ok, :existing}
      nil -> {:ok, :new}
    end
  end

  defp ensure_no_active_job(event, worker) do
    worker_name = Atom.to_string(worker)

    if Repo.exists?(
         from(job in Oban.Job,
           where:
             job.worker == ^worker_name and job.args["event_id"] == ^event.id and
               job.state in ^@active_job_states
         )
       ) do
      {:error, :outbox_recovery_job_busy}
    else
      {:ok, :pass}
    end
  end

  defp reset_event(event) do
    event
    |> Event.changeset(%{
      status: :waiting,
      attempts: 0,
      available_at: DateTime.utc_now(:second),
      locked_at: nil,
      locked_by: nil,
      completed_at: nil,
      last_error_code: nil,
      last_error_at: nil
    })
    |> Repo.update()
  end

  defp record_retry(event, retry_operation_ref, initiator) do
    attrs =
      Map.merge(initiator, %{
        event_id: event.id,
        failure_generation: event.failure_generation,
        failed_error_code: event.last_error_code || "outbox_failed",
        failed_error_at: event.last_error_at || DateTime.utc_now(:second),
        original_operation_ref: event.operation_ref,
        retry_operation_ref: retry_operation_ref,
        occurred_at: DateTime.utc_now(:second)
      })

    %Retry{}
    |> Retry.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_job(worker, event_id) do
    with {:ok, changeset} <- Jobs.outbox_new(worker, %{event_id: event_id}) do
      Oban.insert(changeset)
    end
  end
end
