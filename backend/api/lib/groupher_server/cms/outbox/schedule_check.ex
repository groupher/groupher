defmodule GroupherServer.CMS.Outbox.ScheduleCheck do
  @moduledoc """
  Finds stale Outbox events without an active Oban wakeup and restores scheduling.

  Candidate selection and repair are bounded. Event rows stay locked while the
  owner rechecks their lease and matching Oban jobs and inserts a replacement
  wakeup in the same transaction.

      Oban Cron -> ScheduleCheck -> stale event + missing job -> locked repair
  """

  require Logger

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs, Repo}
  alias CMS.Outbox.{Event, ScheduleConfig, WorkerRegistry}

  @batch_size 100
  @lease_seconds 120
  @active_job_states ["available", "scheduled", "retryable", "executing"]

  @doc "Checks and repairs at most one bounded batch of stale Outbox schedules."
  @spec reconcile() :: {:ok, map()} | {:error, term()}
  def reconcile do
    if Jobs.config_skip_enqueue?() do
      summary = %{outcome: :skipped, reason: :enqueue_disabled, scanned: 0, schedule_missing: 0}
      emit_summary(summary)
      {:ok, summary}
    else
      reconcile_enabled()
    end
  end

  defp reconcile_enabled do
    now = DateTime.utc_now(:second)
    stale_after_seconds = ScheduleConfig.stale_after_seconds()

    result =
      Repo.transact_result(fn ->
        events = stale_candidates(now, stale_after_seconds)

        Enum.reduce_while(events, {:ok, initial_summary()}, fn event, {:ok, summary} ->
          case reconcile_event(event, now, stale_after_seconds) do
            {:ok, :still_scheduled} ->
              {:cont, {:ok, %{summary | scanned: summary.scanned + 1}}}

            {:ok, :valid_lease} ->
              {:cont, {:ok, %{summary | scanned: summary.scanned + 1}}}

            {:ok, {:repaired, details}} ->
              {:cont,
               {:ok,
                summary
                |> Map.update!(:scanned, &(&1 + 1))
                |> Map.update!(:schedule_missing, &(&1 + 1))
                |> Map.update!(:repaired, &(&1 + 1))
                |> Map.update!(:diagnostics, &[details | &1])}}

            {:error, reason} ->
              {:halt, {:error, reason}}
          end
        end)
      end)

    case result do
      {:ok, summary} ->
        emit_diagnostics(summary.diagnostics)
        summary = Map.drop(summary, [:diagnostics]) |> Map.put(:outcome, :checked)
        emit_summary(summary)
        {:ok, summary}

      {:error, reason} ->
        Logger.error("CMS Outbox schedule reconciliation failed", reason: inspect(reason))
        {:error, reason}
    end
  end

  defp initial_summary do
    %{scanned: 0, schedule_missing: 0, repaired: 0, diagnostics: []}
  end

  defp stale_candidates(now, stale_after_seconds) do
    waiting_cutoff = DateTime.add(now, -stale_after_seconds, :second)
    running_cutoff = DateTime.add(now, -(@lease_seconds + stale_after_seconds), :second)
    active_jobs = active_jobs_query()

    Repo.all(
      from(event in Event,
        as: :event,
        where:
          (event.status in [:waiting, :retrying] and event.available_at <= ^waiting_cutoff) or
            (event.status == :running and
               ((not is_nil(event.locked_at) and event.locked_at <= ^running_cutoff) or
                  (is_nil(event.locked_at) and event.available_at <= ^waiting_cutoff))),
        where: not exists(subquery(active_jobs)),
        order_by: [asc: event.available_at, asc: event.id],
        limit: ^@batch_size,
        lock: "FOR UPDATE SKIP LOCKED"
      )
    )
  end

  defp active_jobs_query do
    from(job in Oban.Job,
      where: job.worker == parent_as(:event).worker,
      where:
        fragment(
          "?->>'event_id' = ?",
          job.args,
          type(parent_as(:event).id, :string)
        ),
      where: job.state in ^@active_job_states,
      select: 1
    )
  end

  defp reconcile_event(%Event{} = event, now, stale_after_seconds) do
    cond do
      not stale?(event, now, stale_after_seconds) ->
        {:ok, :still_scheduled}

      valid_lease?(event, now) ->
        {:ok, :valid_lease}

      active_job?(event) ->
        {:ok, :still_scheduled}

      true ->
        repair_wakeup(event)
    end
  end

  defp stale?(%Event{status: status, available_at: available_at}, now, stale_after_seconds)
       when status in [:waiting, :retrying] do
    DateTime.compare(available_at, DateTime.add(now, -stale_after_seconds, :second)) != :gt
  end

  defp stale?(%Event{status: :running, locked_at: locked_at}, now, stale_after_seconds)
       when not is_nil(locked_at) do
    stale_deadline = DateTime.add(locked_at, @lease_seconds + stale_after_seconds, :second)
    DateTime.compare(stale_deadline, now) != :gt
  end

  defp stale?(%Event{status: :running, available_at: available_at}, now, stale_after_seconds) do
    DateTime.compare(available_at, DateTime.add(now, -stale_after_seconds, :second)) != :gt
  end

  defp stale?(_event, _now, _stale_after_seconds), do: false

  defp valid_lease?(%Event{status: :running, locked_at: %DateTime{} = locked_at}, now) do
    DateTime.compare(DateTime.add(locked_at, @lease_seconds, :second), now) == :gt
  end

  defp valid_lease?(_event, _now), do: false

  defp active_job?(event) do
    event_id = to_string(event.id)

    Repo.exists?(
      from(job in Oban.Job,
        where:
          job.worker == ^event.worker and
            fragment("?->>'event_id' = ?", job.args, ^event_id) and
            job.state in ^@active_job_states
      )
    )
  end

  defp repair_wakeup(%Event{} = event) do
    with {:ok, worker} <- WorkerRegistry.worker_for(event.worker),
         {:ok, _job} <- worker.new(%{event_id: event.id}) |> Oban.insert() do
      {:ok, {:repaired, diagnostic(event)}}
    else
      :error ->
        log_repair_failure(event, :unknown_worker_route)
        {:error, {:outbox_worker_route_unknown, event.id, event.worker}}

      {:error, reason} ->
        log_repair_failure(event, reason)
        {:error, {:outbox_schedule_wakeup_failed, event.id, reason}}
    end
  end

  defp log_repair_failure(event, reason) do
    details = diagnostic(event)

    Logger.error("CMS Outbox schedule_missing repair failed",
      event_id: details.event_id,
      event: details.event,
      status: details.status,
      worker: details.worker,
      stale_since: DateTime.to_iso8601(details.stale_since),
      reason: inspect(reason)
    )
  end

  defp diagnostic(%Event{} = event) do
    stale_since =
      case {event.status, event.locked_at} do
        {:running, %DateTime{} = locked_at} ->
          DateTime.add(locked_at, @lease_seconds, :second)

        _ ->
          event.available_at
      end

    %{
      event_id: event.id,
      event: event.event,
      status: event.status,
      worker: event.worker,
      stale_since: stale_since
    }
  end

  defp emit_diagnostics(diagnostics) do
    Enum.each(diagnostics, fn details ->
      Logger.warning("CMS Outbox schedule_missing repaired",
        event_id: details.event_id,
        event: details.event,
        status: details.status,
        worker: details.worker,
        stale_since: DateTime.to_iso8601(details.stale_since)
      )
    end)
  end

  defp emit_summary(%{outcome: :skipped} = summary) do
    :telemetry.execute(
      [:groupher, :cms, :outbox, :schedule_check],
      %{scanned: 0, schedule_missing: 0, repaired: 0},
      %{outcome: :skipped, reason: summary.reason}
    )
  end

  defp emit_summary(summary) do
    :telemetry.execute(
      [:groupher, :cms, :outbox, :schedule_check],
      %{
        scanned: summary.scanned,
        schedule_missing: summary.schedule_missing,
        repaired: summary.repaired
      },
      %{outcome: summary.outcome}
    )
  end
end
