defmodule GroupherServer.Analysis.Aggregator do
  @moduledoc """
  Aggregates pending MetricEvents into Article hourly metrics.

      MetricEvent backlog -> bounded worker -> hourly Article metric
  """

  import Ecto.Query

  alias GroupherServer.{Analysis, Repo}
  alias Analysis.{Config, MetricEvent, Model}
  alias MetricEvent, as: MetricEventAPI
  alias Model.{ArticleHourlyMetric, MetricEvent}

  @doc "Consumes a bounded batch with row locks and an atomic aggregate/ack transaction."
  @spec run(pos_integer()) :: {:ok, non_neg_integer()} | {:error, term()}
  def run(limit \\ Config.aggregation_batch_size()) when is_integer(limit) and limit > 0 do
    case Repo.transaction(fn -> run_batch(limit) end) do
      {:ok, count} ->
        {:ok, count}

      {:error, {:aggregation_failed, event_ids, reason}} ->
        MetricEventAPI.record_failure(event_ids, reason)
        {:error, reason}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Drains several bounded batches and reports whether more work remains."
  @spec drain(pos_integer(), pos_integer()) ::
          {:ok, non_neg_integer(), boolean()} | {:error, term()}
  def drain(
        limit \\ Config.aggregation_batch_size(),
        max_batches \\ Config.aggregation_max_batches()
      )
      when is_integer(limit) and limit > 0 and is_integer(max_batches) and max_batches > 0 do
    do_drain(limit, max_batches, 0, 0)
  end

  defp do_drain(_limit, 0, total, _last_count), do: {:ok, total, true}

  defp do_drain(limit, batches_left, total, _last_count) do
    case run(limit) do
      {:ok, count} when count < limit -> {:ok, total + count, false}
      {:ok, count} -> do_drain(limit, batches_left - 1, total + count, count)
      {:error, reason} -> {:error, reason}
    end
  end

  defp lock_pending(limit) do
    from(event in MetricEvent,
      where: is_nil(event.aggregated_at),
      order_by: [asc: event.inserted_at],
      limit: ^limit,
      lock: "FOR UPDATE SKIP LOCKED"
    )
    |> Repo.all()
  end

  defp run_batch(limit) do
    events = lock_pending(limit)

    try do
      aggregate_events(events)
    rescue
      exception ->
        Repo.rollback({:aggregation_failed, Enum.map(events, & &1.id), exception})
    end
  end

  defp aggregate_events([]), do: 0

  defp aggregate_events(events) do
    now = DateTime.utc_now(:second)

    events
    |> Enum.group_by(&aggregate_key/1)
    |> Enum.each(fn {
                      {community_id, article_type, article_id, bucket, metric, actor_type,
                       is_authenticated, policy_version},
                      grouped_events
                    } ->
      value = Enum.reduce(grouped_events, 0, &(&1.value + &2))

      attrs = %{
        community_id: community_id,
        article_type: article_type,
        article_id: article_id,
        bucket_started_at: bucket,
        metric: metric,
        actor_type: actor_type,
        is_authenticated: is_authenticated,
        policy_version: policy_version,
        value: value,
        inserted_at: now,
        updated_at: now
      }

      Repo.insert_all(ArticleHourlyMetric, [attrs],
        on_conflict: [inc: [value: value], set: [updated_at: now]],
        conflict_target: [
          :article_type,
          :article_id,
          :bucket_started_at,
          :metric,
          :actor_type,
          :is_authenticated,
          :policy_version
        ]
      )
    end)

    ids = Enum.map(events, & &1.id)

    Repo.update_all(
      from(event in MetricEvent, where: event.id in ^ids),
      set: [aggregated_at: now, last_error: nil]
    )

    length(events)
  end

  defp aggregate_key(event) do
    {
      event.community_id,
      event.article_type,
      event.article_id,
      hour_start(event.occurred_at),
      event.metric,
      event.actor_type,
      event.is_authenticated,
      event.policy_version
    }
  end

  defp hour_start(%DateTime{} = datetime) do
    DateTime.from_unix!(div(DateTime.to_unix(datetime), 3600) * 3600)
  end
end
