defmodule GroupherServer.CMS.Interactions.ViewEvents.Record do
  @moduledoc """
  Persists idempotent Article view events and schedules their projection.

      Article Reader -> Record -> ViewEvent + projection job
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Jobs, Repo}
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Interactions.ErrorCat
  alias GroupherServer.CMS.Interactions.ViewEvents.Project
  alias GroupherServer.CMS.Model.ViewEvent

  @doc """
  Records one durable Article view without taking the aggregate lock.

  ## Examples

      ViewEvents.Record.record(article, viewer, event_id)

  """
  @spec record(struct(), User.t() | nil, Ecto.UUID.t() | nil) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  def record(article, viewer, event_id) do
    case Matcher.match_interaction(article) do
      {:ok, %{collection?: true}} ->
        Repo.transaction(fn ->
          case do_record(article, viewer, event_id) do
            {:ok, recorded_event_id} -> recorded_event_id
            {:error, reason} -> Repo.rollback(reason)
            _ -> Repo.rollback(ErrorCat.view_event_insert_failed())
          end
        end)
        |> case do
          {:ok, recorded_event_id} -> {:ok, recorded_event_id}
          {:error, %GroupherServer.ErrorCat.Error{}} = error -> error
          {:error, _reason} -> {:error, ErrorCat.view_event_insert_failed()}
        end

      _ ->
        {:error, ErrorCat.unsupported_artiment("record_view only supports Article")}
    end
  end

  defp do_record(article, user, event_id) do
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
      case Project.project(event_id) do
        :ok -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    else
      Jobs.view_projection(event_id)
    end
  end

  defp insert_or_validate(event_id, target_type, target_id, user) do
    event_user_id = user_id(user)

    attrs = %{
      event_id: event_id,
      target_id: target_id,
      target_type: target_type,
      user_id: event_user_id
    }

    {inserted, _} =
      Repo.insert_all(
        ViewEvent,
        [Map.merge(attrs, %{inserted_at: now(), updated_at: now()})],
        on_conflict: :nothing,
        conflict_target: :event_id
      )

    case Repo.get(ViewEvent, event_id) do
      %ViewEvent{} = event
      when event.target_type == target_type and event.target_id == target_id and
             event.user_id == event_user_id ->
        {:ok, event}

      %ViewEvent{} when inserted == 0 ->
        {:error, ErrorCat.view_event_identity_mismatch()}

      _ ->
        {:error, ErrorCat.view_event_insert_failed()}
    end
  end

  defp normalize_event_id(nil), do: {:ok, Ecto.UUID.generate()}

  defp normalize_event_id(event_id) do
    case Ecto.UUID.cast(event_id) do
      {:ok, event_id} -> {:ok, event_id}
      :error -> {:error, ErrorCat.invalid_event_id()}
    end
  end

  defp now, do: DateTime.utc_now(:second)
  defp user_id(%User{id: id}), do: id
  defp user_id(nil), do: nil
end
