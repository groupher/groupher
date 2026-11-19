defmodule GroupherServer.CMS.Outbox do
  @moduledoc """
  Transactional CMS effect outbox.

  `send/1` is called while the domain transaction is open and inserts both the
  event and its Oban wakeup into that transaction. `execute/3` owns the shared
  claim, lease, retry and completion protocol; each Worker still owns the
  meaning of its event.

  Business position:

      domain transaction
        -> Outbox event + Oban wakeup
        -> worker claim/lease/retry -> committed external effect
  """

  import Ecto.Query

  alias GroupherServer.CMS

  alias GroupherServer.{ErrorCat, Jobs, Repo}
  alias CMS.Outbox.{Event, WorkerRegistry}

  @lease_seconds 120

  @doc "Retries a dead intent after current root admission in the manual recovery Command."
  defdelegate retry_event(event_id, expected_failure_generation, actor, reason),
    to: CMS.Outbox.ManualRetry,
    as: :retry

  @type event_attrs :: %{
          required(:event) => String.t(),
          required(:resource_type) => String.t(),
          required(:resource_id) => String.t() | integer(),
          required(:operation_ref) => Ecto.UUID.t(),
          required(:dedupe_key) => String.t(),
          optional(:contract_version) => pos_integer(),
          optional(:data) => map(),
          required(:worker) => module()
        }

  @doc "Inserts an event and its Oban wakeup in the caller's transaction."
  @spec send(event_attrs()) :: {:ok, Event.t()} | {:error, term()}
  def send(attrs) when is_map(attrs) do
    data = normalize_data(Map.get(attrs, :data, %{}))
    contract_version = Map.get(attrs, :contract_version, 1)

    with true <- Repo.in_transaction?(),
         {:ok, event} <- Map.fetch(attrs, :event),
         {:ok, {worker, worker_name}} <- required_worker(attrs),
         {:ok, operation_ref} <- required_operation_ref(attrs),
         {:ok, dedupe_key} <- required_dedupe_key(attrs),
         {:ok, resource_type} <- Map.fetch(attrs, :resource_type),
         {:ok, resource_id} <- Map.fetch(attrs, :resource_id),
         {:ok, :pass} <-
           require_current_version(
             contract_version,
             event,
             resource_type,
             resource_id,
             dedupe_key
           ),
         {:ok, payload_projection} <- payload_projection(event, data) do
      id = Ecto.UUID.generate()
      data = normalize_data(Map.get(attrs, :data, %{}))

      event_attrs = %{
        id: id,
        event: event,
        contract_version: contract_version,
        worker: worker_name,
        resource_type: resource_type,
        resource_id: to_string(resource_id),
        operation_ref: operation_ref,
        dedupe_key: dedupe_key,
        failure_generation: 0,
        data: data,
        status: :waiting,
        attempts: 0,
        inserted_at: DateTime.utc_now(:second),
        updated_at: DateTime.utc_now(:second),
        available_at: DateTime.utc_now(:second)
      }

      changeset = Event.changeset(%Event{}, event_attrs)

      if changeset.valid? do
        case Repo.insert_all(Event, [event_attrs],
               on_conflict: :nothing,
               conflict_target: [:event, :resource_type, :resource_id, :dedupe_key],
               returning: true
             ) do
          {1, [event_record]} ->
            with {:ok, _job} <- enqueue(worker, event_record.id), do: {:ok, event_record}

          {0, []} ->
            existing_event(event_attrs, payload_projection)
        end
      else
        {:error, changeset}
      end
    else
      false -> {:error, :transaction_required}
      :error -> {:error, :outbox_event_attributes_required}
      {:error, _reason} = error -> error
    end
  end

  @doc "Claims, executes and completes one event under a lease, leaving action failures retryable."
  @spec execute(Ecto.UUID.t(), (Event.t() ->
                                  {:ok, term()} | {:defer, pos_integer()} | {:error, term()})) ::
          {:ok, term()} | {:busy, pos_integer()} | {:snooze, pos_integer()} | {:error, term()}
  def execute(event_id, action) when is_binary(event_id) and is_function(action, 1) do
    execute(event_id, action, on_error: :retry)
  end

  @doc """
  Persists action failures as retryable, terminal, or classified by ErrorCat while holding the claim fence.

  `:retry` preserves the original action error after writing retrying. `:fail`
  always writes a terminal failure. `:classify` makes retryability explicit
  ErrorCat values terminal or retryable and treats unstructured errors as
  transient. A failed terminal-state write is returned as its persistence or
  stale-lease error, never as successful exhaustion.

  ## Examples

      CMS.Outbox.execute(event_id, fn event -> {:ok, event.id} end, on_error: :classify)
      #=> {:ok, value} | {:busy, seconds} | {:error, reason}
  """
  @spec execute(
          Ecto.UUID.t(),
          (Event.t() -> {:ok, term()} | {:defer, pos_integer()} | {:error, term()}),
          keyword()
        ) ::
          {:ok, term()} | {:busy, pos_integer()} | {:snooze, pos_integer()} | {:error, term()}
  def execute(event_id, action, opts)
      when is_binary(event_id) and is_function(action, 1) and is_list(opts) do
    case Keyword.get(opts, :on_error, :retry) do
      mode when mode in [:retry, :fail, :classify] -> execute_claimed(event_id, action, mode)
      _ -> {:error, CMS.ErrorCat.invalid_body("on_error must be :retry, :fail, or :classify")}
    end
  end

  def execute(_event_id, _action, _opts), do: {:error, CMS.ErrorCat.invalid_body()}

  defp execute_claimed(event_id, action, on_error) do
    lock_ref = "#{node()}:#{Ecto.UUID.generate()}"

    case claim(event_id, lock_ref) do
      {:ok, :done} -> {:ok, :done}
      {:ok, %Event{} = event} -> run_action(event, lock_ref, action, on_error)
      {:busy, seconds} -> {:busy, seconds}
      {:error, reason} -> {:error, reason}
    end
  end

  defp claim(event_id, lock_ref) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      case Repo.one(from(event in Event, where: event.id == ^event_id, lock: "FOR UPDATE")) do
        nil ->
          Repo.rollback(:outbox_event_not_found)

        %Event{contract_version: version} = event when version != 1 ->
          Repo.rollback({:outbox_contract_version_conflict, event.id})

        %Event{status: :done} ->
          {:ok, :done}

        %Event{status: :failed} ->
          Repo.rollback(:outbox_event_failed)

        %Event{status: :running} = event ->
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

  defp run_action(event, lock_ref, action, on_error) do
    case action.(event) do
      {:ok, value} ->
        case complete(event.id, lock_ref) do
          {:ok, _} -> {:ok, value}
          {:error, reason} -> {:error, reason}
        end

      {:defer, seconds} when is_integer(seconds) and seconds in 1..86_400 ->
        case defer(event.id, lock_ref, :temporarily_unavailable, seconds) do
          {:ok, :pass} -> {:snooze, seconds}
          {:error, reason} -> {:error, reason}
        end

      {:error, reason} = error ->
        action_failure(event.id, lock_ref, reason, on_error, error)

      other ->
        reason = {:invalid_outbox_result, other}
        action_failure(event.id, lock_ref, reason, on_error, {:error, reason})
    end
  rescue
    exception ->
      action_failure(
        event.id,
        lock_ref,
        {:exception, exception.__struct__},
        on_error,
        {:error, exception}
      )
  end

  defp action_failure(
         event_id,
         lock_ref,
         {:cloudflare_rate_limited, seconds} = reason,
         mode,
         _original_error
       )
       when mode in [:retry, :classify] and is_integer(seconds) and seconds in 1..86_400 do
    case defer(event_id, lock_ref, reason, seconds) do
      {:ok, :pass} -> {:snooze, seconds}
      {:error, persist_reason} -> {:error, persist_reason}
    end
  end

  defp action_failure(event_id, lock_ref, reason, :retry, original_error) do
    case fail(event_id, lock_ref, reason) do
      {:ok, :pass} -> original_error
      {:error, persist_reason} -> {:error, persist_reason}
    end
  end

  defp action_failure(event_id, lock_ref, reason, :fail, _original_error) do
    case fail_terminal(event_id, lock_ref, reason) do
      {:ok, :pass} -> {:error, CMS.ErrorCat.outbox_delivery_exhausted()}
      {:error, persist_reason} -> {:error, persist_reason}
    end
  end

  defp action_failure(event_id, lock_ref, reason, :classify, original_error) do
    mode =
      case reason do
        %ErrorCat.Error{retryable: false} -> :fail
        _ -> :retry
      end

    action_failure(event_id, lock_ref, reason, mode, original_error)
  end

  defp complete(event_id, lock_ref) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :running and event.locked_by == ^lock_ref
        ),
        set: [
          status: :done,
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
            event.id == ^event_id and event.status == :running and event.locked_by == ^lock_ref
        ),
        set: [
          status: :retrying,
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

  defp defer(event_id, lock_ref, reason, seconds) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :running and event.locked_by == ^lock_ref
        ),
        set: [
          status: :retrying,
          last_error_code: error_code(reason),
          last_error_at: now,
          locked_at: nil,
          locked_by: nil,
          available_at: DateTime.add(now, seconds, :second),
          updated_at: now
        ]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_lock}
  end

  defp fail_terminal(event_id, lock_ref, reason) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(event in Event,
          where:
            event.id == ^event_id and event.status == :running and event.locked_by == ^lock_ref
        ),
        set: [
          status: :failed,
          last_error_code: error_code(reason),
          last_error_at: now,
          locked_at: nil,
          locked_by: nil,
          updated_at: now
        ],
        inc: [failure_generation: 1]
      )

    if updated == 1, do: {:ok, :pass}, else: {:error, :stale_lock}
  end

  defp claim_row(event, lock_ref, now) do
    event
    |> Event.changeset(%{
      status: :running,
      attempts: event.attempts + 1,
      locked_at: now,
      locked_by: lock_ref,
      updated_at: now
    })
    |> Repo.update!()
  end

  defp enqueue(worker, event_id) do
    if Jobs.config_skip_enqueue?() do
      {:ok, :skipped}
    else
      worker.new(%{event_id: event_id}) |> Oban.insert()
    end
  end

  defp required_worker(attrs) do
    case Map.get(attrs, :worker) do
      nil ->
        {:error, :outbox_worker_required}

      worker when is_atom(worker) ->
        case WorkerRegistry.name_for(worker) do
          {:ok, worker_name} -> {:ok, {worker, worker_name}}
          :error -> {:error, :outbox_worker_invalid}
        end

      _ ->
        {:error, :outbox_worker_invalid}
    end
  end

  defp required_operation_ref(attrs) do
    case Ecto.UUID.cast(Map.get(attrs, :operation_ref)) do
      {:ok, operation_ref} -> {:ok, operation_ref}
      :error -> {:error, :outbox_operation_ref_required}
    end
  end

  defp required_dedupe_key(%{dedupe_key: key}) when is_binary(key) do
    if String.trim(key) == "", do: {:error, :outbox_dedupe_key_required}, else: {:ok, key}
  end

  defp required_dedupe_key(_attrs), do: {:error, :outbox_dedupe_key_required}

  defp existing_event(attrs, expected_projection) do
    query =
      from(event in Event,
        where:
          event.event == ^attrs.event and event.resource_type == ^attrs.resource_type and
            event.resource_id == ^attrs.resource_id and event.dedupe_key == ^attrs.dedupe_key,
        lock: "FOR UPDATE"
      )

    case Repo.one(query) do
      %Event{} = event ->
        cond do
          event.contract_version != 1 or event.contract_version != attrs.contract_version ->
            {:error, {:outbox_contract_version_conflict, event.id}}

          event.worker != attrs.worker ->
            {:error, {:outbox_worker_conflict, event.id}}

          payload_projection(event.event, event.data) != {:ok, expected_projection} ->
            {:error, {:outbox_payload_conflict, event.id}}

          event.status == :failed ->
            {:error, {:outbox_effect_dead, event.id}}

          event.status in [:waiting, :running, :retrying, :done] ->
            {:ok, event}

          true ->
            {:error, {:outbox_status_unknown, event.id}}
        end

      nil ->
        {:error, :outbox_conflict_row_missing}
    end
  end

  defp require_current_version(1, _event, _resource_type, _resource_id, _dedupe_key) do
    {:ok, :pass}
  end

  defp require_current_version(_version, event, resource_type, resource_id, dedupe_key) do
    id =
      Repo.one(
        from(row in Event,
          where:
            row.event == ^event and row.resource_type == ^resource_type and
              row.resource_id == ^to_string(resource_id) and row.dedupe_key == ^dedupe_key,
          select: row.id
        )
      )

    {:error, {:outbox_contract_version_conflict, id}}
  end

  defp payload_projection(event, data)
       when event in [
              "article.cdn_purge",
              "article.first_published_notification",
              "article.projections",
              "article.published",
              "article.review_changed",
              "article.search_sync",
              "article.updated",
              "article.visibility_changed"
            ] do
    GroupherServer.CMS.Articles.Effects.Outbox.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["mention.notify"] do
    GroupherServer.CMS.ArtimentMentions.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data)
       when event in ["asset.application_upload_provider_delete", "asset.provider_delete"] do
    GroupherServer.CMS.Assets.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data)
       when event in [
              "comment.changed",
              "comment.created",
              "comment.deleted",
              "comment.replied",
              "comment.updated"
            ] do
    GroupherServer.CMS.Comments.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["community.admin_request"] do
    GroupherServer.CMS.Communities.Admins.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data)
       when event in ["community.analysis_provision", "community.presentation_changed"] do
    GroupherServer.CMS.Communities.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["community.taxonomy_changed"] do
    GroupherServer.CMS.Communities.Tags.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["community.pagi_mode_changed"] do
    GroupherServer.CMS.Dashboard.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["doc_tree.changed"] do
    GroupherServer.CMS.DocTree.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["docs.approval_status"] do
    GroupherServer.CMS.DocTree.Publication.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data)
       when event in [
              "interaction.collect_changed",
              "interaction.emotion_changed",
              "interaction.upvote_changed"
            ] do
    GroupherServer.CMS.Interactions.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["press.cache_invalidation"] do
    GroupherServer.CMS.Press.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["cms.artiment_review"] do
    GroupherServer.CMS.Review.Effects.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["ticket.cache_invalidation"] do
    GroupherServer.CMS.Tickets.Effects.Cache.payload_projection(event, data)
  end

  defp payload_projection(event, data) when event in ["ticket.notification"] do
    GroupherServer.CMS.Tickets.Effects.Notifications.payload_projection(event, data)
  end

  defp payload_projection("article.co_author_request", data) do
    Event.project_fields(data, [
      "article_id",
      "request_id",
      "request_revision",
      "request_type",
      "request_action",
      "event_type",
      "recipient_id",
      "actor"
    ])
  end

  defp payload_projection(event, _data), do: {:error, {:outbox_event_owner_missing, event}}

  defp normalize_data(%DateTime{} = value), do: DateTime.to_iso8601(value)

  defp normalize_data(data) when is_map(data) do
    Map.new(data, fn {key, value} -> {to_string(key), normalize_data(value)} end)
  end

  defp normalize_data(data) when is_list(data), do: Enum.map(data, &normalize_data/1)
  defp normalize_data(nil), do: nil
  defp normalize_data(value) when is_atom(value), do: Atom.to_string(value)
  defp normalize_data(value), do: value

  defp lease_expired?(%Event{locked_at: nil}, _now), do: true

  defp lease_expired?(%Event{locked_at: locked_at}, now) do
    DateTime.diff(now, locked_at, :second) >= @lease_seconds
  end

  defp remaining_lease(%Event{locked_at: locked_at}, now) do
    max(@lease_seconds - max(DateTime.diff(now, locked_at, :second), 0), 1)
  end

  defp error_code(%ErrorCat.Error{code: code}) when is_integer(code) do
    Integer.to_string(code)
  end

  defp error_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code({reason, _}) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code(_reason), do: "outbox_failed"
end
