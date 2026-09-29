defmodule GroupherServer.CMS.ViewTracker.ViewDedupeCleanup do
  @moduledoc """
  Removes expired View dedupe state across multiple bounded batches.

      Oban cron
        -> cleanup_expired/0
        -> oldest expired ViewDedupeState rows first
        -> stop when drained or the row/time budget is exhausted

  Every delete rechecks `expires_at`, so a concurrent counted view that
  advances the state cannot be removed using a stale selection.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ViewTracker.{Config, Model.ViewDedupeState}

  @telemetry_event [:groupher, :cms, :view_tracker, :dedupe_cleanup]

  @doc """
  Deletes expired dedupe rows until drained or a row/time budget is exhausted.

  Each batch selects the oldest candidates, then rechecks `expires_at` in the
  DELETE so a concurrent counted view cannot lose freshly advanced state. The
  returned counters and telemetry distinguish a drained run from one that must
  continue during the next scheduled execution.
  """
  @spec cleanup_expired() :: %{
          deleted_rows: non_neg_integer(),
          batch_count: non_neg_integer(),
          duration_ms: non_neg_integer(),
          budget_exhausted: boolean(),
          remaining_expired_rows: non_neg_integer()
        }
  def cleanup_expired do
    started_at = System.monotonic_time(:millisecond)
    result = drain(0, 0, started_at)

    :telemetry.execute(
      @telemetry_event,
      %{
        deleted_rows: result.deleted_rows,
        batch_count: result.batch_count,
        duration_ms: result.duration_ms,
        remaining_expired_rows: result.remaining_expired_rows
      },
      %{budget_exhausted: result.budget_exhausted}
    )

    result
  end

  defp drain(deleted_rows, batch_count, started_at) do
    elapsed = elapsed_ms(started_at)
    remaining_budget = Config.cleanup_row_budget() - deleted_rows

    if remaining_budget <= 0 or elapsed >= Config.cleanup_time_budget_ms() do
      finish(deleted_rows, batch_count, started_at)
    else
      batch_size = min(Config.cleanup_batch_size(), remaining_budget)
      deleted = delete_batch(batch_size)
      total = deleted_rows + deleted
      batches = if deleted > 0, do: batch_count + 1, else: batch_count

      if deleted == 0,
        do: finish(total, batches, started_at),
        else: drain(total, batches, started_at)
    end
  end

  defp finish(deleted_rows, batch_count, started_at) do
    remaining = remaining_expired_rows()

    %{
      deleted_rows: deleted_rows,
      batch_count: batch_count,
      duration_ms: elapsed_ms(started_at),
      budget_exhausted: remaining > 0,
      remaining_expired_rows: remaining
    }
  end

  defp delete_batch(limit) do
    keys =
      from(state in ViewDedupeState,
        where: state.expires_at <= fragment("clock_timestamp()"),
        order_by: [asc: state.expires_at, asc: state.thread, asc: state.article_id],
        limit: ^limit,
        select: {state.thread, state.article_id, state.viewer_tracking_key}
      )
      |> Repo.all()

    predicate =
      Enum.reduce(keys, dynamic(false), fn {thread, article_id, tracking_key}, predicate ->
        dynamic(
          [state],
          ^predicate or
            (state.thread == ^thread and state.article_id == ^article_id and
               state.viewer_tracking_key == ^tracking_key)
        )
      end)

    {count, _} =
      Repo.delete_all(
        from(state in ViewDedupeState,
          where: ^predicate,
          where: state.expires_at <= fragment("clock_timestamp()")
        )
      )

    count
  end

  defp remaining_expired_rows do
    Repo.aggregate(
      from(state in ViewDedupeState,
        where: state.expires_at <= fragment("clock_timestamp()")
      ),
      :count
    )
  end

  defp elapsed_ms(started_at), do: System.monotonic_time(:millisecond) - started_at
end
