defmodule GroupherServer.CMS.Interactions.ViewEvents.Maintenance do
  @moduledoc """
  Owns retention and operational metrics for durable view events.

      retention job / telemetry -> Maintenance -> ViewEvent rows
  """

  import Ecto.Query

  alias GroupherServer.CMS.Interactions.Config
  alias GroupherServer.CMS.Model.ViewEvent
  alias GroupherServer.Repo

  @doc """
  Deletes processed events older than the configured retention window.

  ## Examples

      ViewEvents.Maintenance.delete_expired()

  """
  @spec delete_expired() :: {non_neg_integer(), nil}
  def delete_expired do
    cutoff = DateTime.add(now(), -Config.view_event_retention_days(), :day)

    Repo.delete_all(
      from(event in ViewEvent,
        where: not is_nil(event.processed_at) and event.processed_at < ^cutoff
      )
    )
  end

  @doc """
  Returns pending, failed, age, and worker-lag metrics.

  ## Examples

      ViewEvents.Maintenance.metrics()

  """
  @spec metrics() :: map()
  def metrics do
    %{pending: pending, oldest: oldest, latest_processed: latest_processed, failed: failed} =
      from(event in ViewEvent,
        select: %{
          pending: filter(count(event.event_id), is_nil(event.processed_at)),
          oldest: filter(min(event.inserted_at), is_nil(event.processed_at)),
          latest_processed: filter(max(event.processed_at), not is_nil(event.processed_at)),
          failed:
            filter(
              count(event.event_id),
              not is_nil(event.failed_at) and is_nil(event.processed_at)
            )
        }
      )
      |> Repo.one()

    %{
      pending_view_events_count: pending,
      oldest_pending_view_event_age_seconds: oldest && DateTime.diff(now(), oldest, :second),
      failed_view_events_count: failed,
      view_worker_lag_seconds: worker_lag_seconds(oldest, latest_processed)
    }
  end

  defp worker_lag_seconds(nil, _latest_processed), do: 0
  defp worker_lag_seconds(oldest, nil), do: max(DateTime.diff(now(), oldest, :second), 0)

  defp worker_lag_seconds(oldest, latest_processed) do
    max(DateTime.diff(oldest, latest_processed, :second), 0)
  end

  defp now, do: DateTime.utc_now(:second)
end
