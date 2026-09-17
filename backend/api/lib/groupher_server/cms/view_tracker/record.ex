defmodule GroupherServer.CMS.ViewTracker.Record do
  @moduledoc """
  Persists idempotent Article view decisions.

      Article read -> Record transaction -> ViewEvent -> Analysis metric
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs, Repo}

  alias CMS.Artiment.Matcher
  alias CMS.ViewTracker.{Config, ErrorCat, Identity, Policy, Project}
  alias CMS.ViewTracker.Model.DedupeState
  alias CMS.ViewTracker.Model.ViewEvent
  alias GroupherServer.Analysis.MetricEvent

  @doc "Records a view without taking the Article aggregate lock."
  @spec track(struct(), struct() | nil, Ecto.UUID.t() | nil, keyword()) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  def track(article, viewer, event_id, opts \\ []) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         true <- thread in CMS.Artiment.Threads.article_enums(),
         {:ok, event_id} <- normalize_event_id(event_id),
         {:ok, identity} <- Identity.resolve(viewer, opts),
         received_at <- DateTime.utc_now(:second),
         {:ok, decision} <-
           Policy.evaluate(identity, Keyword.put(opts, :received_at, received_at)) do
      Repo.transaction(fn ->
        attrs =
          event_attrs(
            event_id,
            thread,
            article.id,
            article.community_id,
            identity,
            decision,
            received_at
          )

        case insert_event(attrs) do
          {:inserted, %ViewEvent{counted: false} = event} ->
            event.event_id

          {:inserted, %ViewEvent{} = event} ->
            record_public_event(event, identity, received_at)

          :conflict ->
            resolve_existing(attrs)
        end
      end)
      |> transaction_result()
    else
      false -> {:error, ErrorCat.unsupported_artiment()}
      {:error, _reason} = error -> error
    end
  end

  defp insert_event(attrs) do
    case Repo.insert_all(ViewEvent, [attrs], on_conflict: :nothing, returning: true) do
      {1, [%ViewEvent{} = event]} -> {:inserted, event}
      {1, [row]} when is_map(row) -> {:inserted, struct(ViewEvent, row)}
      {0, _rows} -> :conflict
    end
  end

  defp resolve_existing(attrs) do
    case Repo.get(ViewEvent, attrs.event_id) do
      %ViewEvent{} = event ->
        if same_identity?(event, attrs) do
          event.event_id
        else
          Repo.rollback(ErrorCat.view_event_identity_mismatch())
        end

      nil ->
        Repo.rollback(ErrorCat.view_event_insert_failed())
    end
  end

  defp same_identity?(%ViewEvent{} = event, attrs) do
    event.thread == attrs.thread and
      event.article_id == attrs.article_id and
      event.community_id == attrs.community_id and
      event.user_id == attrs.user_id and
      event.viewer_tracking_key == attrs.viewer_tracking_key and
      event.actor_type == attrs.actor_type and
      event.is_authenticated == attrs.is_authenticated and
      event.actor_confidence == attrs.actor_confidence and
      event.classified_by == attrs.classified_by and
      event.read_purpose == attrs.read_purpose
  end

  defp record_public_event(%ViewEvent{} = event, _identity, received_at) do
    case claim_dedupe(event, received_at) do
      :counted ->
        append_metric!(event)
        enqueue_or_project(event.event_id)
        event.event_id

      :duplicate ->
        mark_duplicate(event.event_id, received_at)
        event.event_id
    end
  end

  defp claim_dedupe(%ViewEvent{viewer_tracking_key: nil}, _received_at),
    do: :counted

  defp claim_dedupe(%ViewEvent{} = event, received_at) do
    cutoff = DateTime.add(received_at, -Config.dedupe_window_seconds(), :second)

    attrs = %{
      thread: event.thread,
      article_id: event.article_id,
      viewer_tracking_key: event.viewer_tracking_key,
      last_counted_at: received_at,
      inserted_at: received_at
    }

    conflict_query =
      from(state in DedupeState,
        update: [set: [last_counted_at: ^received_at]],
        where: state.last_counted_at <= ^cutoff
      )

    case Repo.insert_all(DedupeState, [attrs],
           on_conflict: conflict_query,
           conflict_target: [:thread, :article_id, :viewer_tracking_key],
           returning: true
         ) do
      {1, _rows} -> :counted
      {0, _rows} -> :duplicate
    end
  end

  defp mark_duplicate(event_id, now) do
    {1, _} =
      Repo.update_all(
        from(event in ViewEvent, where: event.event_id == ^event_id),
        set: [
          counted: false,
          decision_reason: :duplicate_in_window,
          projected_at: now,
          projection_state: :applied,
          current_projection_job_id: nil,
          projection_retry_deadline_at: nil
        ]
      )

    :ok
  end

  defp append_metric!(%ViewEvent{counted: true, event_id: event_id} = event) do
    case MetricEvent.append(%{
           operation_id: event_id,
           community_id: event.community_id,
           article_type: event.thread,
           article_id: event.article_id,
           metric: :article_view,
           value: 1,
           actor_type: event.actor_type,
           is_authenticated: event.is_authenticated,
           policy_version: event.policy_version,
           occurred_at: event.occurred_at
         }) do
      :ok -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp enqueue_or_project(event_id) do
    case Jobs.Config.skip_enqueue?() do
      true ->
        case Project.project(event_id) do
          :ok -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end

      false ->
        case Jobs.view_projection(event_id, 1) do
          {:ok, %Oban.Job{id: job_id}} ->
            Project.register_projection_job(event_id, 1, job_id)

          {:ok, :pass} ->
            :ok

          {:error, reason} ->
            Repo.rollback(reason)
        end
    end
  end

  defp event_attrs(
         event_id,
         thread,
         article_id,
         community_id,
         identity,
         decision,
         received_at
       ) do
    now = received_at

    %{
      event_id: event_id,
      thread: thread,
      article_id: article_id,
      community_id: community_id,
      user_id: identity.user_id,
      viewer_tracking_key: identity.viewer_tracking_key,
      actor_type: identity.actor_type,
      is_authenticated: identity.is_authenticated,
      actor_confidence: identity.actor_confidence,
      classified_by: identity.classified_by,
      occurred_at: received_at,
      policy_version: decision.policy_version,
      counted: decision.counted,
      decision_reason: decision.decision_reason,
      read_purpose: decision.read_purpose,
      projected_at: if(decision.counted, do: nil, else: now),
      projection_state: if(decision.counted, do: :pending, else: :applied),
      projection_generation: 1,
      projection_retry_deadline_at:
        DateTime.add(now, Config.projection_retry_window_seconds(), :second),
      inserted_at: now,
      updated_at: now
    }
  end

  defp normalize_event_id(nil), do: {:ok, Ecto.UUID.generate()}

  defp normalize_event_id(event_id) do
    case Ecto.UUID.cast(event_id) do
      {:ok, event_id} -> {:ok, event_id}
      :error -> {:error, ErrorCat.invalid_event_id()}
    end
  end

  defp transaction_result({:ok, event_id}), do: {:ok, event_id}
  defp transaction_result({:error, reason}), do: {:error, reason}
end
