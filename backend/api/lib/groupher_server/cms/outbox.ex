defmodule GroupherServer.CMS.Outbox do
  @moduledoc """
  Transactional CMS effect outbox.

  `send/1` is called while the domain transaction is open and inserts both the
  event and its Oban wakeup into that transaction. `execute/2` owns the shared
  claim, lease, retry and completion protocol; each Worker still owns the
  meaning of its event.

  Business position:

      domain transaction
        -> Outbox event + Oban wakeup
        -> worker claim/lease/retry -> committed external effect
  """

  import Ecto.Query

  alias GroupherServer.{Jobs, Repo}
  alias GroupherServer.CMS.Outbox.Event

  @lease_seconds 120

  @type event_attrs :: %{
          required(:event) => String.t(),
          required(:resource_type) => String.t(),
          required(:resource_id) => String.t() | integer(),
          optional(:command_id) => String.t(),
          optional(:identity) => {:command | :workflow, String.t()},
          optional(:effect_key) => String.t(),
          optional(:contract_version) => pos_integer(),
          optional(:retry_failed) => boolean(),
          optional(:data) => map(),
          required(:worker) => module()
        }

  @doc "Inserts an event and its Oban wakeup in the caller's transaction."
  @spec send(event_attrs()) :: {:ok, Event.t()} | {:error, term()}
  def send(attrs) when is_map(attrs) do
    with {:ok, event} <- Map.fetch(attrs, :event),
         {:ok, worker} <- required_worker(attrs),
         {:ok, {identity_type, command_id}} <- required_identity(attrs),
         {:ok, resource_type} <- Map.fetch(attrs, :resource_type),
         {:ok, resource_id} <- Map.fetch(attrs, :resource_id) do
      event_attrs = %{
        id: Map.get(attrs, :id, Ecto.UUID.generate()),
        event: event,
        contract_version: Map.get(attrs, :contract_version, 1),
        resource_type: resource_type,
        resource_id: to_string(resource_id),
        command_id: command_id,
        identity_type: identity_type,
        effect_key: effect_key(attrs),
        data: normalize_data(Map.get(attrs, :data, %{})),
        status: :pending,
        attempts: 0,
        available_at: DateTime.utc_now(:second)
      }

      changeset = Event.changeset(%Event{}, event_attrs)

      case Repo.insert(changeset,
             on_conflict: [set: [effect_key: event_attrs.effect_key]],
             conflict_target: [
               :identity_type,
               :command_id,
               :event,
               :resource_type,
               :resource_id,
               :effect_key
             ],
             returning: true
           ) do
        {:ok, event_record} when event_record.id == event_attrs.id ->
          with {:ok, _job} <- enqueue(worker, event_record.id), do: {:ok, event_record}

        {:ok, %Event{} = event_record} ->
          maybe_retry_existing(event_record, worker, attrs)

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc "Claims, executes and completes one event under a lease."
  @spec execute(Ecto.UUID.t(), (Event.t() -> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:busy, pos_integer()} | {:error, term()}
  def execute(event_id, action) when is_binary(event_id) and is_function(action, 1) do
    lock_ref = "#{node()}:#{Ecto.UUID.generate()}"

    case claim(event_id, lock_ref) do
      {:ok, :completed} -> {:ok, :completed}
      {:ok, %Event{} = event} -> run_action(event, lock_ref, action)
      {:busy, seconds} -> {:busy, seconds}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Marks a failed event dead after its worker has exhausted retries."
  def mark_dead(event_id) when is_binary(event_id) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where: event.id == ^event_id and event.status == :failed
        ),
        set: [status: :dead, updated_at: now, last_error_at: now]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_event}
  end

  @doc false
  def mark_dead(event_id, lock_ref) when is_binary(event_id) and is_binary(lock_ref) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :failed and event.locked_by == ^lock_ref
        ),
        set: [status: :dead, updated_at: now, last_error_at: now]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_lock}
  end

  defp claim(event_id, lock_ref) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      case Repo.one(from(event in Event, where: event.id == ^event_id, lock: "FOR UPDATE")) do
        nil ->
          Repo.rollback(:outbox_event_not_found)

        %Event{status: :completed} ->
          {:ok, :completed}

        %Event{status: :dead} ->
          Repo.rollback(:outbox_event_dead)

        %Event{status: :executing} = event ->
          if lease_expired?(event, now) do
            {:ok, claim_row(event, lock_ref, now)}
          else
            {:busy, remaining_lease(event, now)}
          end

        %Event{} = event ->
          {:ok, claim_row(event, lock_ref, now)}
      end
    end)
    |> case do
      {:ok, result} -> result
      {:error, reason} -> {:error, reason}
    end
  end

  defp run_action(event, lock_ref, action) do
    case action.(event) do
      {:ok, value} ->
        case complete(event.id, lock_ref) do
          {:ok, _} -> {:ok, value}
          {:error, reason} -> {:error, reason}
        end

      {:error, reason} = error ->
        _ = fail(event.id, lock_ref, reason)
        error

      other ->
        reason = {:invalid_outbox_result, other}
        _ = fail(event.id, lock_ref, reason)
        {:error, reason}
    end
  rescue
    exception ->
      _ = fail(event.id, lock_ref, {:exception, exception.__struct__})
      {:error, exception}
  end

  defp complete(event_id, lock_ref) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :executing and event.locked_by == ^lock_ref
        ),
        set: [
          status: :completed,
          completed_at: now,
          locked_at: nil,
          locked_by: nil,
          updated_at: now
        ]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_lock}
  end

  defp fail(event_id, lock_ref, reason) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :executing and event.locked_by == ^lock_ref
        ),
        set: [
          status: :failed,
          last_error_code: error_code(reason),
          last_error_at: now,
          locked_at: nil,
          locked_by: nil,
          available_at: now,
          updated_at: now
        ]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_lock}
  end

  defp claim_row(event, lock_ref, now) do
    event
    |> Event.changeset(%{
      status: :executing,
      attempts: event.attempts + 1,
      locked_at: now,
      locked_by: lock_ref,
      updated_at: now
    })
    |> Repo.update!()
  end

  defp enqueue(worker, event_id) do
    if Jobs.Config.skip_enqueue?() do
      {:ok, :skipped}
    else
      worker.new(%{event_id: event_id}) |> Oban.insert()
    end
  end

  defp maybe_retry_existing(%Event{status: status} = event, worker, attrs)
       when status in [:failed, :dead] do
    if Map.get(attrs, :retry_failed, false) do
      now = DateTime.utc_now(:second)

      case Repo.transaction(fn ->
             with {:ok, event} <-
                    event
                    |> Event.changeset(%{
                      status: :pending,
                      attempts: 0,
                      available_at: now,
                      locked_at: nil,
                      locked_by: nil,
                      completed_at: nil,
                      last_error_code: nil,
                      last_error_at: nil
                    })
                    |> Repo.update(),
                  {:ok, _job} <- enqueue(worker, event.id) do
               event
             else
               {:error, reason} -> Repo.rollback(reason)
             end
           end) do
        {:ok, event} -> {:ok, event}
        {:error, reason} -> {:error, reason}
      end
    else
      {:ok, event}
    end
  end

  defp maybe_retry_existing(%Event{} = event, _worker, _attrs), do: {:ok, event}

  defp required_worker(attrs) do
    case Map.get(attrs, :worker) do
      nil ->
        {:error, :outbox_worker_required}

      worker when is_atom(worker) ->
        {:ok, worker}

      _ ->
        {:error, :outbox_worker_invalid}
    end
  end

  defp required_identity(attrs) do
    case Map.fetch(attrs, :identity) do
      {:ok, {:command, command_id}} -> cast_command_identity(command_id)
      {:ok, {:workflow, workflow_ref}} -> cast_workflow_identity(workflow_ref)
      {:ok, _invalid} -> {:error, :outbox_identity_required}
      :error -> cast_command_identity(Map.get(attrs, :command_id))
    end
  end

  defp cast_command_identity(command_id) do
    case Ecto.UUID.cast(command_id) do
      {:ok, command_id} -> {:ok, {:command, command_id}}
      :error -> {:error, :outbox_command_id_required}
    end
  end

  defp cast_workflow_identity(workflow_ref)
       when is_binary(workflow_ref) and byte_size(workflow_ref) > 0 do
    {:ok, {:workflow, workflow_ref}}
  end

  defp cast_workflow_identity(_workflow_ref), do: {:error, :outbox_workflow_ref_required}

  defp effect_key(attrs) do
    case Map.get(attrs, :effect_key) do
      key when is_binary(key) and key != "" -> key
      _ -> "default"
    end
  end

  defp normalize_data(%DateTime{} = value), do: DateTime.to_iso8601(value)

  defp normalize_data(data) when is_map(data) do
    Map.new(data, fn {key, value} -> {to_string(key), normalize_data(value)} end)
  end

  defp normalize_data(data) when is_list(data), do: Enum.map(data, &normalize_data/1)
  defp normalize_data(value) when is_atom(value), do: Atom.to_string(value)
  defp normalize_data(value), do: value

  defp lease_expired?(%Event{locked_at: nil}, _now), do: true

  defp lease_expired?(%Event{locked_at: locked_at}, now) do
    DateTime.diff(now, locked_at, :second) >= @lease_seconds
  end

  defp remaining_lease(%Event{locked_at: locked_at}, now) do
    max(@lease_seconds - max(DateTime.diff(now, locked_at, :second), 0), 1)
  end

  defp error_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code({reason, _}) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code(_reason), do: "outbox_failed"
end
