defmodule GroupherServer.CMS.Interactions.ViewEvents.Project do
  @moduledoc """
  Projects durable view events into Article views and Interaction read state.

      Oban worker -> Project -> Article views + ReadState
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.Matcher
  alias CMS.Interactions.{Config, ErrorCat, ReadState}
  alias CMS.Model.ViewEvent

  @doc """
  Projects one event idempotently, batching pending events for the same Article.

  ## Examples

      ViewEvents.Project.project(event_id)

  """
  @spec project(Ecto.UUID.t()) :: :ok | {:error, term()}
  def project(event_id) do
    Repo.transaction(fn ->
      case Repo.get(ViewEvent, event_id) do
        nil -> Repo.rollback(ErrorCat.target_not_found())
        %ViewEvent{processed_at: processed_at} when not is_nil(processed_at) -> :ok
        %ViewEvent{} = event -> project_target(event)
      end
    end)
    |> transaction_result()
  end

  @doc """
  Records a failed projection attempt for retry observability.

  ## Examples

      ViewEvents.Project.record_failure(event_id, reason)

  """
  @spec record_failure(Ecto.UUID.t(), term()) :: :ok
  def record_failure(event_id, reason) do
    Repo.update_all(
      from(event in ViewEvent, where: event.event_id == ^event_id),
      set: [failed_at: now(), failure_reason: inspect(reason)],
      inc: [retry_count: 1]
    )

    :ok
  end

  defp project_target(%ViewEvent{target_type: target_type, target_id: target_id}) do
    events = lock_pending_events(target_type, target_id)

    if events == [] do
      :ok
    else
      with {:ok, %{model: model}} <- Matcher.match(target_type),
           :ok <- increment_views(model, target_id, length(events)),
           :ok <- project_viewed_users(target_type, target_id, events),
           {_, _} <- mark_processed(events) do
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
      _ -> {:error, ErrorCat.target_not_found()}
    end
  end

  defp project_viewed_users(_target_type, _target_id, []), do: :ok

  defp project_viewed_users(target_type, target_id, events) do
    user_ids = events |> Enum.map(& &1.user_id) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    case user_ids do
      [] -> :ok
      _ -> ReadState.merge_viewed_users(target_type, target_id, user_ids)
    end
  end

  defp mark_processed(events) do
    Repo.update_all(
      from(event in ViewEvent, where: event.event_id in ^Enum.map(events, & &1.event_id)),
      set: [processed_at: now(), failed_at: nil, failure_reason: nil]
    )
  end

  defp transaction_result({:ok, :ok}), do: :ok
  defp transaction_result({:error, reason}), do: {:error, reason}
  defp now, do: DateTime.utc_now(:second)
end
