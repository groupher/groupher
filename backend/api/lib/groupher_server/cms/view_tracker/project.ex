defmodule GroupherServer.CMS.ViewTracker.Project do
  @moduledoc """
  Projects counted view events into Article totals and authenticated viewer state.

      pending ViewEvent -> Project transaction -> Article totals / viewer state
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs, Repo}
  alias CMS.Artiment.Matcher
  alias CMS.ViewTracker.ErrorCat
  alias CMS.Model.{Blog, Changelog, Doc}
  alias CMS.ViewTracker.{Config, Model}
  alias Model.{DedupeState, ViewEvent, ViewSummary, ViewerState}

  @article_models %{
    post: CMS.Model.Post,
    blog: Blog,
    changelog: Changelog,
    doc: Doc
  }

  @doc "Projects one event and batches other pending events for the same Article."
  @spec project(Ecto.UUID.t(), pos_integer() | nil) :: :ok | {:error, term()}
  def project(event_id, generation \\ nil) do
    Repo.transaction(fn ->
      case Repo.get(ViewEvent, event_id) do
        nil ->
          Repo.rollback(ErrorCat.target_not_found())

        %ViewEvent{projection_state: state}
        when state in [:applied, :article_deleted, :dropped] ->
          :ok

        %ViewEvent{projection_generation: current}
        when is_integer(generation) and generation != current ->
          :ok

        %ViewEvent{projection_state: :dead_letter} ->
          :ok

        %ViewEvent{} = event ->
          project_target(event)
      end
    end)
    |> transaction_result()
  end

  @doc "Records a failed projection attempt without failing the worker transaction."
  @spec record_failure(Ecto.UUID.t(), term(), pos_integer() | nil) :: :ok
  def record_failure(event_id, reason, generation \\ nil) do
    query =
      from(event in ViewEvent,
        where: event.event_id == ^event_id and event.projection_state == :pending
      )

    query =
      if is_integer(generation),
        do: where(query, [event], event.projection_generation == ^generation),
        else: query

    Repo.update_all(query,
      set: [failed_at: now(), failure_reason: inspect(reason)],
      inc: [retry_count: 1]
    )

    :ok
  end

  @doc "Registers the current Oban job only while the same projection generation remains pending."
  @spec register_projection_job(Ecto.UUID.t(), pos_integer(), pos_integer()) :: :ok
  def register_projection_job(event_id, generation, job_id) do
    Repo.update_all(
      from(event in ViewEvent,
        where:
          event.event_id == ^event_id and event.projection_state == :pending and
            event.projection_generation == ^generation
      ),
      set: [current_projection_job_id: job_id]
    )

    :ok
  end

  @doc "Moves a still-current failed projection to dead-letter without changing Summary."
  @spec dead_letter(Ecto.UUID.t(), pos_integer(), term()) :: :ok
  def dead_letter(event_id, generation, reason) do
    Repo.update_all(
      from(event in ViewEvent,
        where:
          event.event_id == ^event_id and event.projection_state == :pending and
            event.projection_generation == ^generation
      ),
      set: [
        projection_state: :dead_letter,
        failed_at: now(),
        failure_reason: inspect(reason)
      ]
    )

    :ok
  end

  @doc "Reopens one dead-letter event as a new projection generation."
  @spec replay(Ecto.UUID.t()) :: :ok | {:error, term()}
  def replay(event_id) do
    Repo.transaction(fn ->
      case Repo.one(
             from(event in ViewEvent,
               where: event.event_id == ^event_id and event.projection_state == :dead_letter,
               lock: "FOR UPDATE"
             )
           ) do
        nil ->
          Repo.rollback(ErrorCat.projection_not_dead_letter())

        %ViewEvent{projection_generation: generation} ->
          next_generation = generation + 1

          {1, _} =
            Repo.update_all(
              from(event in ViewEvent,
                where:
                  event.event_id == ^event_id and event.projection_state == :dead_letter and
                    event.projection_generation == ^generation
              ),
              set: [
                projection_state: :pending,
                projected_at: nil,
                current_projection_job_id: nil,
                projection_retry_deadline_at:
                  DateTime.add(
                    DateTime.utc_now(:second),
                    Config.projection_retry_window_seconds(),
                    :second
                  ),
                failed_at: nil,
                failure_reason: nil,
                retry_count: 0
              ],
              inc: [projection_generation: 1]
            )

          enqueue_replay(event_id, next_generation)
      end
    end)
    |> transaction_result()
  end

  @doc "Permanently drops one dead-letter event without projecting it."
  @spec resolve_as_dropped(Ecto.UUID.t()) :: :ok | {:error, term()}
  def resolve_as_dropped(event_id) do
    {count, _} =
      Repo.update_all(
        from(event in ViewEvent,
          where: event.event_id == ^event_id and event.projection_state == :dead_letter
        ),
        set: [
          projection_state: :dropped,
          projected_at: DateTime.utc_now(:second),
          current_projection_job_id: nil,
          projection_retry_deadline_at: nil
        ]
      )

    if count == 1, do: :ok, else: {:error, ErrorCat.projection_not_dead_letter()}
  end

  @doc "Cleans Article view projections during permanent Article deletion."
  @spec delete_article_projection(atom(), pos_integer()) :: :ok
  def delete_article_projection(thread, article_id) do
    Repo.delete_all(
      from(summary in ViewSummary,
        where: summary.thread == ^thread and summary.article_id == ^article_id
      )
    )

    Repo.delete_all(
      from(state in ViewerState,
        where: state.thread == ^thread and state.article_id == ^article_id
      )
    )

    Repo.delete_all(
      from(state in DedupeState,
        where: state.thread == ^thread and state.article_id == ^article_id
      )
    )

    Repo.update_all(
      from(event in ViewEvent,
        where:
          event.thread == ^thread and event.article_id == ^article_id and
            event.counted == true and
            event.projection_state in [:pending, :applied, :dead_letter]
      ),
      set: [
        projection_state: :article_deleted,
        projected_at: DateTime.utc_now(:second),
        current_projection_job_id: nil,
        projection_retry_deadline_at: nil
      ]
    )

    :ok
  end

  defp project_target(%ViewEvent{thread: thread, article_id: article_id}) do
    with {:ok, model} <- model_for(thread) do
      case lock_article(model, article_id) do
        :missing ->
          events = lock_pending_events(thread, article_id)
          mark_terminal(events, :article_deleted)
          :ok

        :ok ->
          events = lock_pending_events(thread, article_id)

          if events == [] do
            :ok
          else
            :ok = upsert_summary(thread, article_id, length(events))
            :ok = project_viewer_states(thread, article_id, events)
            mark_projected(events)
            :ok
          end
      end
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp lock_pending_events(thread, article_id) do
    from(event in ViewEvent,
      where:
        event.thread == ^thread and event.article_id == ^article_id and
          event.projection_state == :pending and is_nil(event.projected_at) and
          event.counted == true,
      order_by: [asc: event.inserted_at],
      limit: ^view_batch_size(),
      lock: "FOR UPDATE"
    )
    |> Repo.all()
  end

  defp lock_article(model, article_id) do
    case Repo.one(
           from(article in model,
             where: article.id == ^article_id,
             lock: "FOR UPDATE",
             select: article.id
           )
         ) do
      nil -> :missing
      _id -> :ok
    end
  end

  defp upsert_summary(thread, article_id, count) do
    now = now()

    Repo.insert_all(
      ViewSummary,
      [
        %{
          thread: thread,
          article_id: article_id,
          views: count,
          revision: 1,
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict: [inc: [views: count, revision: 1], set: [updated_at: now]],
      conflict_target: [:thread, :article_id]
    )

    :ok
  end

  defp project_viewer_states(thread, article_id, events) do
    rows =
      events
      |> Enum.filter(&(&1.actor_type == :human and &1.is_authenticated == true))
      |> Enum.map(& &1.user_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()
      |> Enum.map(fn user_id ->
        %{thread: thread, article_id: article_id, user_id: user_id, inserted_at: now()}
      end)

    if rows == [] do
      :ok
    else
      Repo.insert_all(ViewerState, rows,
        on_conflict: :nothing,
        conflict_target: [:thread, :article_id, :user_id]
      )

      :ok
    end
  end

  defp mark_projected(events) do
    Repo.update_all(
      from(event in ViewEvent,
        where:
          event.event_id in ^Enum.map(events, & &1.event_id) and
            event.projection_state == :pending
      ),
      set: [
        projected_at: now(),
        projection_state: :applied,
        current_projection_job_id: nil,
        projection_retry_deadline_at: nil,
        failed_at: nil,
        failure_reason: nil
      ]
    )
  end

  defp mark_terminal([], _state), do: {0, nil}

  defp mark_terminal(events, state) do
    Repo.update_all(
      from(event in ViewEvent,
        where:
          event.event_id in ^Enum.map(events, & &1.event_id) and
            event.projection_state == :pending
      ),
      set: [
        projected_at: now(),
        projection_state: state,
        current_projection_job_id: nil,
        projection_retry_deadline_at: nil,
        failed_at: nil,
        failure_reason: nil
      ]
    )
  end

  defp model_for(thread) do
    case Map.fetch(@article_models, thread) do
      {:ok, model} ->
        {:ok, model}

      :error ->
        case Matcher.match(thread) do
          {:ok, %{model: model}} -> {:ok, model}
          _ -> {:error, ErrorCat.unsupported_artiment()}
        end
    end
  end

  defp view_batch_size do
    Config.batch_size()
  end

  defp enqueue_replay(event_id, generation) do
    case Jobs.view_projection(event_id, generation) do
      {:ok, %Oban.Job{id: job_id}} ->
        register_projection_job(event_id, generation, job_id)

      {:ok, :pass} ->
        case project(event_id, generation) do
          :ok -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end

      {:error, reason} ->
        Repo.rollback(reason)
    end
  end

  defp transaction_result({:ok, :ok}), do: :ok
  defp transaction_result({:error, reason}), do: {:error, reason}
  defp now, do: DateTime.utc_now(:second)
end
