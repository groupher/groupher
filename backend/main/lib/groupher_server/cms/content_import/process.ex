defmodule GroupherServer.CMS.ContentImport.Process do
  @moduledoc """
  Projects persisted ImportJob facts into the public import process contract.

      Job status + body counts + recent batch
                         |
                         v
      preparing/applying stage + running/completed/failed state

  This is a projection only; it never persists a second process state machine.

  See `docs/bulk-import/import-process-log.md`.
  """

  alias GroupherServer.CMS.ContentImport.Persistence.Job

  @doc "Projects one persisted Job into the shared UI process shape."
  @spec project(Job.t()) :: map()
  def project(%Job{} = job) do
    bodies = value(job.progress || %{}, "bodies") || %{}
    pending = count(bodies, "pending")
    ready = count(bodies, "ready")
    skipped = count(bodies, "skipped")
    failed = count(bodies, "failed")

    %{
      progress: %{
        completed: ready + skipped + failed,
        total: count(bodies, "total"),
        unit: :document
      },
      recent_batch: project_recent_batch(value(job.progress || %{}, "recentBatch")),
      stage: stage(job.status, pending),
      state: state(job.status),
      updated_at: job.updated_at
    }
  end

  defp state(:completed), do: :completed
  defp state(status) when status in [:failed, :cancelled], do: :failed
  defp state(_status), do: :running

  defp stage(:staging, _pending), do: :preparing
  defp stage(status, _pending) when status in [:ready, :applying, :completed], do: :applying
  defp stage(status, pending) when status in [:failed, :cancelled] and pending > 0, do: :preparing
  defp stage(_status, _pending), do: :applying

  defp project_recent_batch(items) when is_list(items) do
    items
    |> Enum.flat_map(fn item ->
      ref = value(item, "ref")
      label = value(item, "label")
      state = item_state(value(item, "state"))

      if is_binary(ref) and ref != "" and is_binary(label) and label != "" and not is_nil(state) do
        [%{label: label, ref: ref, state: state}]
      else
        []
      end
    end)
    |> Enum.take(5)
  end

  defp project_recent_batch(_items), do: []

  defp item_state("completed"), do: :completed
  defp item_state("failed"), do: :failed
  defp item_state("skipped"), do: :skipped
  defp item_state(state) when state in [:completed, :failed, :skipped], do: state
  defp item_state(_state), do: nil

  defp count(map, key) do
    case value(map, key) do
      value when is_integer(value) and value >= 0 -> value
      _value -> 0
    end
  end

  defp value(map, key), do: Map.get(map, key, Map.get(map, String.to_atom(key)))
end
