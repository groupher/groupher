defmodule GroupherServer.Analysis.Maintenance do
  @moduledoc """
  Retention for rebuildable raw metric events and hourly aggregates.

      retention schedule
              |
              v
      bounded batch drain
          |          |
          v          v
      raw events   hourly metrics

      retention schedule -> bounded batch drain -> expired projections

  Each run has a row budget. A saturated Oban job snoozes and continues, so a
  large backlog cannot turn one daily invocation into an unbounded transaction.
  """

  import Ecto.Query

  alias GroupherServer.{Analysis, Repo}
  alias Analysis.Config
  alias Analysis.Model.{ArticleHourlyMetric, MetricEvent}
  alias Helper.Datetime

  @doc "Returns bounded raw-event backlog and delay metrics without scanning hourly facts."
  @spec metrics() :: map()
  def metrics do
    now = DateTime.utc_now(:second)

    pending_query = from(event in MetricEvent, where: is_nil(event.aggregated_at))
    pending = Repo.aggregate(pending_query, :count)

    failed =
      pending_query
      |> where([event], event.attempts > 0 or not is_nil(event.last_error))
      |> Repo.aggregate(:count)

    oldest_pending_at =
      pending_query
      |> order_by([event], asc: event.inserted_at)
      |> limit(1)
      |> select([event], event.inserted_at)
      |> Repo.one()

    %{
      pending: pending,
      failed: failed,
      oldest_pending_at: oldest_pending_at,
      oldest_pending_age_seconds: pending_age(oldest_pending_at, now)
    }
  end

  @doc "Deletes bounded batches of aggregated raw events and expired hourly buckets."
  @spec delete_expired() :: %{
          metric_events: non_neg_integer(),
          hourly_metrics: non_neg_integer(),
          more?: boolean()
        }
  def delete_expired do
    now = DateTime.utc_now(:second)
    raw_cutoff = DateTime.add(now, -Config.metric_event_retention_days(), :day)
    hourly_cutoff = Datetime.shift(now, months: -Config.hourly_metric_retention_months())

    limit = Config.retention_batch_size()
    max_batches = Config.retention_max_batches()

    {metric_events, raw_more?} =
      drain_batches(
        fn -> delete_metric_event_batch(raw_cutoff, limit) end,
        fn -> expired_metric_events?(raw_cutoff) end,
        limit,
        max_batches
      )

    {hourly_metrics, hourly_more?} =
      drain_batches(
        fn -> delete_hourly_metric_batch(hourly_cutoff, limit) end,
        fn -> expired_hourly_metrics?(hourly_cutoff) end,
        limit,
        max_batches
      )

    %{
      metric_events: metric_events,
      hourly_metrics: hourly_metrics,
      more?: raw_more? or hourly_more?
    }
  end

  defp drain_batches(delete_batch, more?, limit, max_batches) do
    Enum.reduce_while(1..max_batches, 0, fn _batch, total ->
      deleted = delete_batch.()
      total = total + deleted

      if deleted < limit do
        {:halt, {total, false}}
      else
        {:cont, total}
      end
    end)
    |> case do
      {total, false} -> {total, false}
      total -> {total, more?.()}
    end
  end

  defp delete_metric_event_batch(cutoff, limit) do
    {:ok, deleted} =
      Repo.transaction(fn ->
        ids =
          MetricEvent
          |> where([event], not is_nil(event.aggregated_at) and event.occurred_at < ^cutoff)
          |> order_by([event], asc: event.occurred_at, asc: event.id)
          |> limit(^limit)
          |> select([event], event.id)
          |> lock("FOR UPDATE SKIP LOCKED")
          |> Repo.all()

        {deleted, _} =
          Repo.delete_all(
            from(event in MetricEvent,
              where:
                event.id in ^ids and not is_nil(event.aggregated_at) and
                  event.occurred_at < ^cutoff
            )
          )

        deleted
      end)

    deleted
  end

  defp delete_hourly_metric_batch(cutoff, limit) do
    {:ok, deleted} =
      Repo.transaction(fn ->
        ids =
          ArticleHourlyMetric
          |> where([metric], metric.bucket_started_at < ^cutoff)
          |> order_by([metric], asc: metric.bucket_started_at, asc: metric.id)
          |> limit(^limit)
          |> select([metric], metric.id)
          |> lock("FOR UPDATE SKIP LOCKED")
          |> Repo.all()

        {deleted, _} =
          Repo.delete_all(
            from(metric in ArticleHourlyMetric,
              where: metric.id in ^ids and metric.bucket_started_at < ^cutoff
            )
          )

        deleted
      end)

    deleted
  end

  defp expired_metric_events?(cutoff) do
    Repo.exists?(
      from(event in MetricEvent,
        where: not is_nil(event.aggregated_at) and event.occurred_at < ^cutoff
      )
    )
  end

  defp expired_hourly_metrics?(cutoff) do
    Repo.exists?(from(metric in ArticleHourlyMetric, where: metric.bucket_started_at < ^cutoff))
  end

  defp pending_age(nil, _now), do: 0

  defp pending_age(inserted_at, now) do
    max(DateTime.diff(now, inserted_at, :second), 0)
  end
end
