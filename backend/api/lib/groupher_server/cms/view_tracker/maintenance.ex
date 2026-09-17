defmodule GroupherServer.CMS.ViewTracker.Maintenance do
  @moduledoc """
  Retention and telemetry helpers for ViewTracker events.

      scheduler -> Maintenance -> retention / bounded consistency sample
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.Matcher
  alias CMS.ViewTracker.{Config, Model}
  alias Model.{DedupeState, ViewEvent, ViewSummary, ViewerState}

  @active_oban_states [:available, :scheduled, :executing, :retryable]

  @doc "Classifies bounded pending events whose current projection deadline has passed."
  @spec reconcile_dead_letters(pos_integer()) :: non_neg_integer()
  def reconcile_dead_letters(limit \\ 100) when is_integer(limit) and limit > 0 do
    now = DateTime.utc_now(:second)

    from(event in ViewEvent,
      where:
        event.projection_state == :pending and
          not is_nil(event.projection_retry_deadline_at) and
          event.projection_retry_deadline_at <= ^now,
      order_by: [asc: event.projection_retry_deadline_at],
      limit: ^limit,
      select: {event.event_id, event.projection_generation, event.current_projection_job_id}
    )
    |> Repo.all()
    |> Enum.count(fn {event_id, generation, job_id} ->
      if active_projection_job?(job_id) do
        false
      else
        dead_letter_if_current(event_id, generation)
      end
    end)
  end

  @doc "Deletes terminal ViewEvents and stale dedupe state outside their retention windows."
  @spec delete_expired() :: non_neg_integer()
  def delete_expired do
    now = DateTime.utc_now(:second)
    view_cutoff = DateTime.add(now, -Config.view_event_retention_days(), :day)
    dedupe_cutoff = DateTime.add(now, -Config.dedupe_state_retention_days(), :day)

    {view_events, _} =
      Repo.delete_all(
        from(event in ViewEvent,
          where:
            event.projection_state in [:applied, :article_deleted, :dropped] and
              event.occurred_at < ^view_cutoff
        )
      )

    {dedupe_states, _} =
      Repo.delete_all(from(state in DedupeState, where: state.last_counted_at < ^dedupe_cutoff))

    view_events + dedupe_states
  end

  @doc "Returns bounded operational counts without scanning Article facts."
  @spec metrics() :: map()
  def metrics do
    now = DateTime.utc_now(:second)
    dedupe_cutoff = DateTime.add(now, -Config.dedupe_state_retention_days(), :day)
    oldest_dedupe_at = Repo.one(from(state in DedupeState, select: min(state.last_counted_at)))

    %{
      pending:
        Repo.aggregate(
          from(event in ViewEvent, where: event.projection_state == :pending),
          :count
        ),
      failed:
        Repo.aggregate(
          from(event in ViewEvent,
            where: event.projection_state == :pending and not is_nil(event.failed_at)
          ),
          :count
        ),
      dead_letter:
        Repo.aggregate(
          from(event in ViewEvent, where: event.projection_state == :dead_letter),
          :count
        ),
      dropped:
        Repo.aggregate(
          from(event in ViewEvent, where: event.projection_state == :dropped),
          :count
        ),
      retained: Repo.aggregate(ViewEvent, :count),
      dedupe_states: Repo.aggregate(DedupeState, :count),
      dedupe_states_expired:
        Repo.aggregate(
          from(state in DedupeState, where: state.last_counted_at < ^dedupe_cutoff),
          :count
        ),
      oldest_dedupe_at: oldest_dedupe_at,
      oldest_dedupe_age_seconds:
        if(oldest_dedupe_at,
          do: max(0, DateTime.diff(now, oldest_dedupe_at)),
          else: 0
        ),
      consistency_sample: sample_consistency()
    }
  end

  @doc "Samples recent projected human views without repairing any state."
  @spec sample_consistency(pos_integer()) :: map()
  def sample_consistency(limit \\ 100) when is_integer(limit) and limit > 0 do
    rows =
      from(event in ViewEvent,
        left_join: state in ViewerState,
        on:
          state.thread == event.thread and state.article_id == event.article_id and
            state.user_id == event.user_id,
        where:
          event.counted == true and event.actor_type == :human and
            event.is_authenticated == true and
            not is_nil(event.projected_at) and not is_nil(event.user_id),
        order_by: [desc: event.projected_at],
        limit: ^limit,
        select: {event.event_id, state.user_id}
      )
      |> Repo.all()

    summary_rows = sampled_summaries(limit)
    orphan_keys = orphan_summary_keys(summary_rows)
    valid_summary_rows = Enum.reject(summary_rows, &MapSet.member?(orphan_keys, summary_key(&1)))
    drifted_keys = summary_lower_bound_drift(valid_summary_rows)

    %{
      sampled: length(rows),
      missing_viewer_state: Enum.count(rows, fn {_event_id, user_id} -> is_nil(user_id) end),
      summary_sampled: length(summary_rows),
      sampled_orphan_summaries: MapSet.size(orphan_keys),
      summary_consistency_sampled: length(valid_summary_rows),
      summary_drifted: MapSet.size(drifted_keys)
    }
  end

  defp sampled_summaries(limit) do
    from(summary in ViewSummary,
      order_by: [desc: summary.updated_at],
      limit: ^limit,
      select: {summary.thread, summary.article_id, summary.views}
    )
    |> Repo.all()
    |> Enum.map(fn {thread, article_id, views} ->
      %{thread: thread, article_id: article_id, views: views}
    end)
  end

  defp orphan_summary_keys(summary_rows) do
    summary_rows
    |> Enum.group_by(& &1.thread)
    |> Enum.reduce(MapSet.new(), fn {thread, rows}, orphan_keys ->
      ids = Enum.map(rows, & &1.article_id)

      case Matcher.match(thread) do
        {:ok, %{model: model}} ->
          existing_ids =
            from(article in model,
              where: article.id in ^ids,
              select: article.id
            )
            |> Repo.all()
            |> MapSet.new()

          Enum.reduce(rows, orphan_keys, fn row, keys ->
            if MapSet.member?(existing_ids, row.article_id),
              do: keys,
              else: MapSet.put(keys, summary_key(row))
          end)

        _ ->
          Enum.reduce(rows, orphan_keys, &MapSet.put(&2, summary_key(&1)))
      end
    end)
  end

  defp summary_lower_bound_drift([]), do: MapSet.new()

  defp summary_lower_bound_drift(summary_rows) do
    now = DateTime.utc_now(:second)
    cutoff = DateTime.add(now, -Config.view_event_retention_days(), :day)

    predicate =
      Enum.reduce(summary_rows, dynamic(false), fn row, acc ->
        dynamic(
          [event],
          ^acc or (event.thread == ^row.thread and event.article_id == ^row.article_id)
        )
      end)

    event_counts =
      ViewEvent
      |> where(^predicate)
      |> where([event],
        event.counted == true and event.projection_state == :applied and
          event.occurred_at >= ^cutoff
      )
      |> group_by([event], [event.thread, event.article_id])
      |> select([event], {event.thread, event.article_id, count(event.event_id)})
      |> Repo.all()
      |> Map.new(fn {thread, article_id, count} -> {{thread, article_id}, count} end)

    Enum.reduce(summary_rows, MapSet.new(), fn row, drifted ->
      if Map.get(event_counts, summary_key(row), 0) > row.views,
        do: MapSet.put(drifted, summary_key(row)),
        else: drifted
    end)
  end

  defp summary_key(%{thread: thread, article_id: article_id}), do: {thread, article_id}

  defp active_projection_job?(nil), do: false

  defp active_projection_job?(job_id) do
    case Repo.get(Oban.Job, job_id) do
      %Oban.Job{state: state} when state in @active_oban_states -> true
      _ -> false
    end
  end

  defp dead_letter_if_current(event_id, generation) do
    {count, _} =
      Repo.update_all(
        from(event in ViewEvent,
          where:
            event.event_id == ^event_id and event.projection_state == :pending and
              event.projection_generation == ^generation
        ),
        set: [
          projection_state: :dead_letter,
          failed_at: DateTime.utc_now(:second),
          failure_reason: "projection deadline expired without an active Oban job"
        ]
      )

    count == 1
  end
end
