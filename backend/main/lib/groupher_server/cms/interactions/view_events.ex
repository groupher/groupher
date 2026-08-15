defmodule GroupherServer.CMS.Interactions.ViewEvents do
  @moduledoc """
  Durable view-event recording and asynchronous projection.

  A supplied event id is the business idempotency key. Old callers without one
  remain supported, but receive a fresh event id for each read.
  Target types are `Ecto.Enum` values resolved through `CMS.Artiment.Matcher`;
  this module does not maintain a second thread-to-model registry.

  Business position:

      CMS article read -> ViewEvents -> view_events -> ViewProjection worker
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Interactions.{Config, State}
  alias CMS.Model.ViewEvent

  @doc "Records an idempotent durable view event and enqueues asynchronous projection."
  @spec record(term(), User.t() | nil, Ecto.UUID.t() | nil) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  def record(article, user \\ nil, event_id \\ nil) do
    generated_event_id? = is_nil(event_id)

    with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, event_id} <- normalize_event_id(event_id),
         {:ok, event} <- insert_or_validate(event_id, thread, article.id, user),
         {:ok, _job} <- enqueue_or_project(event.event_id, generated_event_id?) do
      {:ok, event.event_id}
    end
  end

  defp enqueue_or_project(event_id, sync?) do
    if Jobs.Config.skip_enqueue?() and sync? do
      project(event_id)
      |> case do
        :ok -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    else
      Jobs.view_projection(event_id)
    end
  end

  @doc "Projects pending view events for one event target in a transaction."
  @spec project(Ecto.UUID.t()) :: :ok | {:error, term()}
  def project(event_id) do
    Repo.transaction(fn ->
      case Repo.get(ViewEvent, event_id) do
        nil -> Repo.rollback(:not_found)
        %ViewEvent{processed_at: processed_at} when not is_nil(processed_at) -> :ok
        %ViewEvent{} = event -> project_target(event)
      end
    end)
    |> transaction_result()
  end

  @doc "Marks a failed projection attempt so the worker can retry it."
  @spec record_failure(Ecto.UUID.t(), term()) :: :ok
  def record_failure(event_id, reason) do
    Repo.update_all(
      from(event in ViewEvent, where: event.event_id == ^event_id),
      set: [failed_at: now(), failure_reason: inspect(reason)],
      inc: [retry_count: 1]
    )

    :ok
  end

  @doc "Deletes processed view events older than the configured retention window."
  @spec delete_expired() :: {non_neg_integer(), nil}
  def delete_expired do
    cutoff = DateTime.add(now(), -Config.view_event_retention_days(), :day)

    Repo.delete_all(
      from(event in ViewEvent,
        where: not is_nil(event.processed_at) and event.processed_at < ^cutoff
      )
    )
  end

  @doc "Returns pending, failed, oldest-pending, and worker-lag view metrics."
  @spec metrics() :: %{
          failed_view_events_count: non_neg_integer(),
          oldest_pending_view_event_age_seconds: non_neg_integer() | nil,
          pending_view_events_count: non_neg_integer(),
          view_worker_lag_seconds: non_neg_integer() | nil
        }
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

  defp insert_or_validate(event_id, target_type, target_id, user) do
    event_user_id = user_id(user)

    attrs = %{
      event_id: event_id,
      target_id: target_id,
      target_type: target_type,
      user_id: event_user_id
    }

    now = now()

    {inserted, _} =
      Repo.insert_all(
        ViewEvent,
        [Map.merge(attrs, %{inserted_at: now, updated_at: now})],
        on_conflict: :nothing,
        conflict_target: :event_id
      )

    case Repo.get(ViewEvent, event_id) do
      %ViewEvent{} = event
      when event.target_type == target_type and event.target_id == target_id and
             event.user_id == event_user_id ->
        {:ok, event}

      %ViewEvent{} when inserted == 0 ->
        {:error, :view_event_identity_mismatch}

      _ ->
        {:error, :view_event_insert_failed}
    end
  end

  defp project_target(%ViewEvent{target_type: target_type, target_id: target_id}) do
    events = lock_pending_events(target_type, target_id)

    if events == [] do
      :ok
    else
      with {:ok, %{model: model}} <- Matcher.match(target_type),
           :ok <- increment_views(model, target_id, length(events)),
           :ok <- project_viewed_users(target_type, target_id, events),
           {_, _} <-
             Repo.update_all(
               from(event in ViewEvent,
                 where: event.event_id in ^Enum.map(events, & &1.event_id)
               ),
               set: [processed_at: now(), failed_at: nil, failure_reason: nil]
             ) do
        :ok
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end
  end

  defp lock_pending_events(target_type, target_id) do
    from(event in ViewEvent,
      where:
        event.target_type == ^target_type and event.target_id == ^target_id and
          is_nil(event.processed_at),
      order_by: [asc: event.inserted_at],
      limit: ^Config.view_batch_size(),
      lock: "FOR UPDATE"
    )
    |> Repo.all()
  end

  defp increment_views(model, target_id, count) do
    case Repo.update_all(from(article in model, where: article.id == ^target_id),
           inc: [views: count]
         ) do
      {1, _} -> :ok
      _ -> {:error, :target_not_found}
    end
  end

  defp project_viewed_users(_target_type, _target_id, events) when events == [], do: :ok

  defp project_viewed_users(target_type, target_id, events) do
    user_ids = events |> Enum.map(& &1.user_id) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    case user_ids do
      [] -> :ok
      _ -> State.merge_viewed_users(target_type, target_id, user_ids)
    end
  end

  defp transaction_result({:ok, :ok}), do: :ok
  defp transaction_result({:error, reason}), do: {:error, reason}

  defp normalize_event_id(nil), do: {:ok, Ecto.UUID.generate()}
  defp normalize_event_id(event_id), do: Ecto.UUID.cast(event_id)

  defp now, do: DateTime.utc_now(:second)

  defp user_id(%User{id: id}), do: id
  defp user_id(nil), do: nil
end
