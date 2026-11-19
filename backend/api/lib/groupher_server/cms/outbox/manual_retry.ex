defmodule GroupherServer.CMS.Outbox.ManualRetry do
  @moduledoc """
  Owns the root-authorized manual recovery entry for a dead Outbox event.

      CMS.retry_outbox_event -> direct Operation Runner -> current root check
        -> lock event + resolve persisted worker -> Outbox.Recovery.requeue
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Outbox.{Event, Recovery, WorkerRegistry}
  alias GroupherServer.Accounts.Model.User

  @doc "Retries one dead event with a current root check and auditable user reason."
  def retry(event_id, expected_failure_generation, %User{id: actor_id} = actor, reason)
      when is_integer(actor_id) and actor_id > 0 do
    run_direct(event_id, expected_failure_generation, actor, reason)
  end

  def retry(_event_id, _expected_failure_generation, _actor, _reason),
    do: {:error, :invalid_outbox_recovery_request}

  @pipeline operation: :cms_outbox_manual_retry,
            access: :internal,
            target: :event_id,
            params: [:expected_failure_generation, :reason]
  direct_pipeline run_direct(event_id, expected_failure_generation, actor, reason) do
    gate(fn _event_id ->
      case CMS.Passport.system_root?(actor.id) do
        {:ok, true} -> {:ok, :authorized}
        _ -> {:error, :permission_denied}
      end
    end)

    change(fn _authorized, operation_ref ->
      with {:ok, event_id} <- Ecto.UUID.cast(event_id),
           true <- is_integer(expected_failure_generation) and expected_failure_generation > 0,
           {:ok, :pass} <- validate_reason(reason),
           {:ok, event} <- lock_event(event_id),
           {:ok, worker} <- resolve_worker(event.worker),
           {:ok, result} <-
             Recovery.requeue(
               event_id,
               expected_failure_generation,
               operation_ref,
               worker,
               %{initiator_kind: "user", actor_id: actor.id, reason: reason}
             ) do
        manual_result({:ok, result})
      else
        false -> {:error, :invalid_outbox_recovery_request}
        :error -> {:error, :invalid_outbox_recovery_request}
        {:error, _reason} = error -> error
      end
    end)
  end

  defp validate_reason(reason) when is_binary(reason) do
    if String.valid?(reason) and String.trim(reason) != "",
      do: {:ok, :pass},
      else: {:error, :outbox_retry_reason_required}
  end

  defp validate_reason(_reason), do: {:error, :outbox_retry_reason_required}

  defp lock_event(event_id) do
    case Repo.one(from(event in Event, where: event.id == ^event_id, lock: "FOR UPDATE")) do
      %Event{} = event -> {:ok, event}
      nil -> {:error, :outbox_event_not_found}
    end
  end

  defp resolve_worker(worker_name) do
    case WorkerRegistry.worker_for(worker_name) do
      {:ok, worker} -> {:ok, worker}
      :error -> {:error, :outbox_worker_invalid}
    end
  end

  defp manual_result({:ok, %{outcome: :skipped}}), do: {:error, :enqueue_disabled}
  defp manual_result(result), do: result
end
