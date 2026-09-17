defmodule GroupherServer.Analysis.Maintenance do
  @moduledoc """
  Retention for rebuildable raw metric events and hourly aggregates.

      retention schedule -> Analysis.Maintenance -> expired projections
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.Analysis.Config
  alias GroupherServer.Analysis.Model.{ArticleHourlyMetric, MetricEvent}
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

  @doc "Deletes only aggregated raw events and hourly buckets beyond retention."
  @spec delete_expired() :: %{metric_events: non_neg_integer(), hourly_metrics: non_neg_integer()}
  def delete_expired do
    now = DateTime.utc_now(:second)
    raw_cutoff = DateTime.add(now, -Config.metric_event_retention_days(), :day)
    hourly_cutoff = Datetime.shift(now, months: -Config.hourly_metric_retention_months())

    {metric_events, _} =
      Repo.delete_all(
        from(event in MetricEvent,
          where: not is_nil(event.aggregated_at) and event.occurred_at < ^raw_cutoff
        )
      )

    {hourly_metrics, _} =
      Repo.delete_all(
        from(metric in ArticleHourlyMetric, where: metric.bucket_started_at < ^hourly_cutoff)
      )

    %{metric_events: metric_events, hourly_metrics: hourly_metrics}
  end

  defp pending_age(nil, _now), do: 0

  defp pending_age(inserted_at, now) do
    max(DateTime.diff(now, inserted_at, :second), 0)
  end
end
