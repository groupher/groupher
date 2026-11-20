defmodule GroupherServer.CMS.Outbox.Recovery do
  @moduledoc """
  Requeues one dead Outbox event under a failure-generation fence.

  Event reset, the one-per-generation retry record, and the Oban wakeup share a
  database transaction. Domain owners perform authorization and freshness
  checks before calling this primitive.

      authorized recovery request -> lock dead event generation
        -> reset + retry fact + Oban wakeup -> commit once
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs, Repo}
  alias CMS.Outbox.{Event, Retry, WorkerRegistry}

  @active_job_states ["available", "scheduled", "retryable", "executing"]

  @doc "Atomically resets and wakes a dead event once for its expected generation."
  def requeue(event_id, expected_generation, operation_ref, worker, initiator)
      when is_binary(event_id) and is_integer(expected_generation) and expected_generation > 0 and
             is_binary(operation_ref) and is_atom(worker) and is_map(initiator) do
    if Jobs.config_skip_enqueue?() do
      {:ok, %{outcome: :skipped, reason: :enqueue_disabled}}
    else
      Repo.transact_result(fn ->
        with {:ok, event} <- lock_event(event_id),
             {:ok, event} <- validate_generation(event, expected_generation),
             {:ok, :pass} <- CMS.Outbox.validate_event_contract(event),
             {:ok, :pass} <- validate_worker(event, worker),
             {:ok, :pass} <- validate_effect(event, operation_ref, initiator) do
          case {event.status, existing_receipt(event)} do
            {_status, {:ok, :existing}} ->
              {:ok, %{outcome: :already_retried, event: event}}

            {:failed, {:ok, :new}} ->
              with {:ok, :pass} <- require_dead(event),
                   {:ok, :pass} <- validate_reset_eligibility(event, initiator),
                   {:ok, :pass} <- ensure_no_active_job(event) do
                recover_current(event, operation_ref, worker, initiator)
              end

            {:running, _} ->
              {:error, :outbox_recovery_job_busy}

            {_status, _receipt} ->
              {:error, :outbox_effect_not_dead}
          end
        end
      end)
    end
  end

  def requeue(_event_id, _expected_generation, _operation_ref, _worker, _initiator) do
    {:error, :invalid_outbox_recovery_request}
  end

  defp recover_current(event, operation_ref, worker, initiator) do
    case CMS.Articles.Effects.recovery_status(event) do
      {:ok, %{outcome: :superseded} = diagnosis} ->
        {:ok, diagnosis}

      {:ok, %{outcome: :pending}} ->
        with {:ok, :pass} <- validate_current_target(event),
             {:ok, updated} <- reset_event(event),
             {:ok, _retry} <- record_retry(event, operation_ref, initiator),
             {:ok, _job} <- insert_job(worker, event.id) do
          {:ok, %{outcome: :requeued, event: updated}}
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp validate_current_target(%Event{event: "article.projections"} = event) do
    with {:ok, _} <- CMS.Articles.Effects.projection_context(event), do: {:ok, :pass}
  end

  defp validate_current_target(%Event{event: "article.search_sync"} = event) do
    with {:ok, _} <- CMS.Articles.Effects.search_context(event), do: {:ok, :pass}
  end

  defp validate_current_target(%Event{event: kind} = event)
       when kind in ["comment.created", "comment.deleted"] do
    with {:ok, _} <- CMS.Comments.Effects.delivery_context(event), do: {:ok, :pass}
  end

  defp validate_current_target(%Event{event: "community.analysis_provision"} = event) do
    with {:ok, _} <- CMS.Communities.Effects.analysis_target(event), do: {:ok, :pass}
  end

  defp validate_current_target(_event), do: {:ok, :pass}

  defp lock_event(event_id) do
    case Repo.one(from(event in Event, where: event.id == ^event_id, lock: "FOR UPDATE")) do
      %Event{} = event -> {:ok, event}
      nil -> {:error, :outbox_event_not_found}
    end
  end

  defp validate_generation(%Event{failure_generation: generation}, expected)
       when generation != expected do
    {:error, :outbox_recovery_stale_generation}
  end

  defp validate_generation(%Event{} = event, _expected), do: {:ok, event}

  defp require_dead(%Event{status: :failed}), do: {:ok, :pass}

  defp validate_worker(event, worker) do
    case WorkerRegistry.name_for(worker) do
      {:ok, name} when name == event.worker -> {:ok, :pass}
      _ -> {:error, :outbox_worker_invalid}
    end
  end

  defp validate_effect(%Event{event: kind} = event, operation_ref, initiator)
       when kind in ["asset.provider_delete", "asset.application_upload_provider_delete"] do
    case CMS.Assets.Deletion.provider_delete_target(event) do
      {:ok, target} -> validate_recovery_owner(target, event, operation_ref, initiator)
      {:error, _reason} = error -> error
    end
  end

  defp validate_effect(%Event{event: "cms.artiment_review"} = event, _operation_ref, _initiator) do
    CMS.Review.Requests.validate_recovery_event(event)
  end

  defp validate_effect(%Event{event: kind} = event, _operation_ref, _initiator)
       when kind in [
              "interaction.upvote_changed",
              "interaction.collect_changed",
              "interaction.emotion_changed"
            ] do
    with {:ok, _context} <- CMS.Interactions.Effects.delivery_context(event) do
      {:ok, :pass}
    end
  end

  defp validate_effect(_event, _operation_ref, _initiator), do: {:ok, :pass}

  defp validate_recovery_owner(target, _event, operation_ref, %{
         initiator_kind: "owner",
         owner_ref: "provider-reconciliation:" <> workflow_ref,
         reason_code: "provider_delete_retry",
         lease_owner: lease_owner
       }) do
    CMS.Assets.ProviderReconciliation.validate_recovery_lease(
      target,
      operation_ref,
      workflow_ref,
      lease_owner
    )
  end

  defp validate_recovery_owner(_target, _event, _operation_ref, %{initiator_kind: "owner"}) do
    {:error, :provider_delete_recovery_lease_invalid}
  end

  defp validate_recovery_owner(_target, _event, _operation_ref, _initiator), do: {:ok, :pass}

  # A competing recovery may already have cleared last_error_code. Only a new
  # reset needs failure classification; the one-per-generation fact proves a replay.
  defp validate_reset_eligibility(%Event{event: kind, last_error_code: code}, %{
         initiator_kind: "owner"
       })
       when kind in ["asset.provider_delete", "asset.application_upload_provider_delete"] and
              code != "5603" do
    {:error, :provider_delete_event_not_recoverable}
  end

  defp validate_reset_eligibility(_event, _initiator), do: {:ok, :pass}

  defp existing_receipt(event) do
    case Repo.get_by(Retry,
           event_id: event.id,
           failure_generation: event.failure_generation
         ) do
      %Retry{} -> {:ok, :existing}
      nil -> {:ok, :new}
    end
  end

  defp ensure_no_active_job(event) do
    worker_name = event.worker

    if Repo.exists?(
         from(job in Oban.Job,
           where:
             job.worker == ^worker_name and job.args["event_id"] == ^event.id and
               job.state in ^@active_job_states
         )
       ) do
      {:error, :outbox_recovery_job_busy}
    else
      {:ok, :pass}
    end
  end

  defp reset_event(event) do
    event
    |> Event.changeset(%{
      status: :waiting,
      attempts: 0,
      available_at: DateTime.utc_now(:second),
      locked_at: nil,
      locked_by: nil,
      completed_at: nil,
      last_error_code: nil,
      last_error_at: nil
    })
    |> Repo.update()
  end

  defp record_retry(event, retry_operation_ref, initiator) do
    attrs =
      Map.merge(initiator, %{
        event_id: event.id,
        failure_generation: event.failure_generation,
        failed_error_code: event.last_error_code || "outbox_failed",
        failed_error_at: event.last_error_at || DateTime.utc_now(:second),
        original_operation_ref: event.operation_ref,
        retry_operation_ref: retry_operation_ref,
        occurred_at: DateTime.utc_now(:second)
      })

    %Retry{}
    |> Retry.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_job(worker, event_id) do
    with {:ok, changeset} <- Jobs.outbox_new(worker, %{event_id: event_id}) do
      Oban.insert(changeset)
    end
  end
end
