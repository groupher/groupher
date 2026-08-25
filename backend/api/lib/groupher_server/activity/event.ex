defmodule GroupherServer.Activity.Event do
  @moduledoc """
  Validates Activity contracts, envelopes and safe projections.

      resource handler -> validated event envelope -> append-only schema
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Activity.{Const, ErrorCat}
  alias GroupherServer.Activity.EventRef
  alias GroupherServer.Repo

  def contract(
        payload \\ [],
        metadata \\ [],
        surfaces \\ [:community_log],
        target \\ nil,
        opts \\ []
      ) do
    surface_contract = fn surface ->
      fields =
        case surface do
          :article_log ->
            [:actor, :subject, :target, :payload, :occurred_at]

          :community_log ->
            [
              :resource,
              :actor,
              :on_behalf_of,
              :subject,
              :target,
              :source,
              :payload,
              :metadata,
              :outcome,
              :denial_code,
              :changed_fields,
              :occurred_at,
              :recorded_at,
              :event_ref,
              :operation_ref,
              :parent_event_ref,
              :operation_index,
              :record_sequence,
              :category,
              :high_risk,
              :message_key
            ]
        end

      exposed_metadata = if surface == :article_log, do: [], else: metadata

      {surface,
       %{
         exposed_fields: fields,
         exposed_payload: payload,
         exposed_metadata: exposed_metadata
       }}
    end

    %{
      write: %{
        target_type: target,
        accepted_payload: payload,
        accepted_metadata: metadata,
        accepted_changed_fields: Keyword.get(opts, :changed_fields, payload)
      },
      outcomes:
        Keyword.get(opts, :outcomes, %{
          allowed: %{producer_status: :active},
          denied: %{producer_status: :contract_only, denial_codes: []}
        }),
      surfaces: Map.new(surfaces, surface_contract),
      subject_search:
        if(:community_log in surfaces,
          do: [:subject_ref, :subject_snapshot_title],
          else: [:subject_ref]
        ),
      producer_status: :active,
      retention: :long_term
    }
  end

  @doc "Marks a declared event contract that intentionally has no V1 producer."
  def contract_only(contract), do: Map.put(contract, :producer_status, :contract_only)

  @presentation_keys %{
    created: %{message_key: "activity.created"},
    title_changed: %{message_key: "activity.title_changed"},
    body_updated: %{message_key: "activity.body_updated"},
    published: %{message_key: "activity.published"},
    publish_restored: %{message_key: "activity.publish_restored"},
    released: %{message_key: "activity.released"},
    release_rescheduled: %{message_key: "activity.release_rescheduled"},
    release_withdrawn: %{message_key: "activity.release_withdrawn"},
    trashed: %{message_key: "activity.trashed"},
    restored: %{message_key: "activity.restored"},
    archived: %{message_key: "activity.archived"},
    permanently_deleted: %{message_key: "activity.permanently_deleted"},
    destroy_scheduled: %{message_key: "activity.destroy_scheduled"},
    destroy_cancelled: %{message_key: "activity.destroy_cancelled"},
    destroyed: %{message_key: "activity.destroyed"},
    lifecycle_reconciled: %{message_key: "activity.lifecycle_reconciled"},
    activity_exported: %{message_key: "activity.activity_exported"},
    comment_created: %{message_key: "activity.comment_created"},
    comment_updated: %{message_key: "activity.comment_updated"},
    comment_pinned: %{message_key: "activity.comment_pinned"},
    comment_unpinned: %{message_key: "activity.comment_unpinned"},
    solution_accepted: %{message_key: "activity.solution_accepted"},
    solution_replaced: %{message_key: "activity.solution_replaced"},
    solution_revoked: %{message_key: "activity.solution_revoked"},
    blocker_created: %{message_key: "activity.blocker_created"},
    blocker_released: %{message_key: "activity.blocker_released"},
    blocker_terminated: %{message_key: "activity.blocker_terminated"},
    setup_failed: %{message_key: "activity.setup_failed"},
    setup_retried: %{message_key: "activity.setup_retried"},
    activated: %{message_key: "activity.activated"},
    config_updated: %{message_key: "activity.config_updated"},
    draft_updated: %{message_key: "activity.draft_updated"},
    moderation_review_started: %{message_key: "activity.moderation_review_started"},
    moderation_review_resolved: %{message_key: "activity.moderation_review_resolved"}
  }

  @doc "Adds the shared product classification to handler-owned action contracts."
  def classify_contracts(contracts) do
    Map.new(contracts, fn {action, contract} ->
      {action,
       contract
       |> Map.put(:classification, classification(action))
       |> Map.put(:presentation, presentation(action))}
    end)
  end

  @doc "Returns the explicit product copy key for an action contract."
  def presentation(action),
    do: Map.get(@presentation_keys, action, %{message_key: "activity.unknown"})

  def classification(action) do
    %{
      category: category_for(action),
      high_risk: action in [:permanently_deleted, :destroyed, :blocker_terminated]
    }
  end

  def log(handler, resource, action, opts) do
    with :ok <- validate_action(action),
         {:ok, contract} <- fetch_contract(handler, action),
         {:ok, descriptor} <- handler.describe(resource, action, opts),
         {:ok, payload} <-
           accepted_payload(opts[:payload] || %{}, contract.write.accepted_payload),
         {:ok, metadata} <-
           accepted_payload(opts[:metadata] || %{}, contract.write.accepted_metadata),
         {:ok, changed_fields} <-
           accepted_changed_fields(
             opts[:changed_fields] || [],
             contract.write.accepted_changed_fields
           ),
         {:ok, outcome} <- validate_outcome(opts, contract),
         :ok <- validate_target(descriptor, contract.write.target_type),
         {:ok, envelope} <- envelope(handler, descriptor, action, opts) do
      attrs =
        descriptor
        |> Map.merge(envelope)
        |> Map.merge(%{
          action: action,
          payload: payload,
          metadata: metadata,
          changed_fields: changed_fields,
          outcome: outcome.outcome,
          denial_code: outcome.denial_code
        })

      schema = handler.schema()

      insert(schema, attrs)
    else
      %GroupherServer.ErrorCat.Error{} = error -> {:error, error}
      {:error, %GroupherServer.ErrorCat.Error{}} = error -> error
      {:error, %Ecto.Changeset{}} = error -> error
    end
  end

  def project(handler, log, surface) do
    with {:ok, contract} <- fetch_contract(handler, log.action),
         {:ok, surface_contract} <- Map.fetch(contract.surfaces, surface) do
      fields = surface_contract.exposed_fields

      base = %{id: public_uuid(log.event_ref), action: log.action}

      result =
        base
        |> maybe_put(:resource, resource(handler, log), :resource in fields)
        |> maybe_put(:actor, actor(log), :actor in fields)
        |> maybe_put(:on_behalf_of, on_behalf_of(log), :on_behalf_of in fields)
        |> maybe_put(
          :subject,
          ref(log.subject_type, log.subject_ref, log.subject_snapshot),
          :subject in fields
        )
        |> maybe_put(:target, target(log), :target in fields)
        |> maybe_put(:source, log.source, :source in fields)
        |> maybe_put(
          :payload,
          take_payload(log.payload, surface_contract.exposed_payload),
          :payload in fields
        )
        |> maybe_put(
          :metadata,
          take_payload(log.metadata, surface_contract.exposed_metadata),
          :metadata in fields
        )
        |> maybe_put(:outcome, log.outcome, :outcome in fields)
        |> maybe_put(:denial_code, log.denial_code, :denial_code in fields)
        |> maybe_put(:changed_fields, log.changed_fields, :changed_fields in fields)
        |> maybe_put(:occurred_at, log.occurred_at, :occurred_at in fields)
        |> maybe_put(:recorded_at, log.recorded_at, :recorded_at in fields)
        |> maybe_put(:event_ref, public_uuid(log.event_ref), :event_ref in fields)
        |> maybe_put(:operation_ref, public_uuid(log.operation_ref), :operation_ref in fields)
        |> maybe_put(
          :parent_event_ref,
          public_uuid(log.parent_event_ref),
          :parent_event_ref in fields
        )
        |> maybe_put(:operation_index, log.operation_index, :operation_index in fields)
        |> maybe_put(:record_sequence, log.record_sequence, :record_sequence in fields)
        |> maybe_put(
          :category,
          classification(contract, log.action).category,
          :category in fields
        )
        |> maybe_put(
          :high_risk,
          classification(contract, log.action).high_risk,
          :high_risk in fields
        )
        |> maybe_put(
          :message_key,
          presentation(contract, log.action).message_key,
          :message_key in fields
        )

      {:ok, result}
    else
      :error -> {:error, ErrorCat.surface_not_exposed()}
      error -> error
    end
  end

  def surface_actions(handler, surface) do
    handler.contracts()
    |> Enum.filter(fn {_action, contract} ->
      Map.has_key?(contract.surfaces, surface) and contract.producer_status == :active
    end)
    |> Enum.map(&elem(&1, 0))
  end

  defp classification(contract, action),
    do: Map.get(contract, :classification, classification(action))

  defp presentation(contract, action),
    do: Map.get(contract, :presentation, presentation(action))

  defp public_uuid(nil), do: nil

  defp public_uuid(value) when is_binary(value) and byte_size(value) == 16 do
    case Ecto.UUID.load(value) do
      {:ok, ref} -> ref
      :error -> value
    end
  end

  defp public_uuid(value), do: value

  defp category_for(action)
       when action in [:created, :title_changed, :body_updated],
       do: :content

  defp category_for(action)
       when action in [
              :published,
              :publish_restored,
              :released,
              :release_rescheduled,
              :release_withdrawn
            ],
       do: :publishing

  defp category_for(action)
       when action in [
              :trashed,
              :restored,
              :archived,
              :permanently_deleted,
              :destroy_scheduled,
              :destroy_cancelled,
              :destroyed,
              :lifecycle_reconciled
            ],
       do: :lifecycle

  defp category_for(action)
       when action in [
              :comment_pinned,
              :comment_unpinned,
              :solution_accepted,
              :solution_replaced,
              :solution_revoked
            ],
       do: :engagement

  defp category_for(action)
       when action in [:blocker_created, :blocker_released, :blocker_terminated],
       do: :moderation

  defp category_for(action)
       when action in [:moderation_review_started, :moderation_review_resolved],
       do: :moderation

  defp category_for(_action), do: :community

  def actor_attrs(%User{} = actor) do
    %{
      actor_type: :user,
      actor_ref: public_user_ref(actor),
      actor_snapshot: %{
        id: public_user_ref(actor),
        login: actor.login,
        nickname: actor.nickname,
        avatar: actor.avatar
      }
    }
  end

  def actor_attrs(:system),
    do: %{actor_type: :system, actor_ref: "groupher", actor_snapshot: %{name: "Groupher"}}

  def actor_attrs(:operations), do: {:error, ErrorCat.invalid_actor()}
  def actor_attrs(nil), do: {:error, ErrorCat.invalid_actor()}
  def actor_attrs(_), do: {:error, ErrorCat.invalid_actor()}

  def snapshot(resource, fields) do
    Map.new(fields, fn field -> {field, Map.get(resource, field)} end)
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  def stringify(nil), do: nil
  def stringify(value) when is_binary(value), do: value
  def stringify(value) when is_atom(value) or is_integer(value), do: to_string(value)
  def stringify(value), do: to_string(value)

  def error(message), do: ErrorCat.unsupported_resource(message)

  defp validate_action(action) when is_atom(action), do: :ok
  defp validate_action(_action), do: {:error, ErrorCat.invalid_action()}

  defp fetch_contract(handler, action) do
    case Map.fetch(handler.contracts(), action) do
      {:ok, contract} -> {:ok, contract}
      :error -> {:error, ErrorCat.unsupported_action(inspect(action))}
    end
  end

  defp accepted_payload(payload, accepted) when is_map(payload) do
    keys = Map.keys(payload)

    if Enum.all?(keys, &accepted_key?(&1, accepted)) do
      {:ok, take_payload(payload, accepted)}
    else
      {:error, ErrorCat.undeclared_payload()}
    end
  end

  defp accepted_payload(_, _), do: {:error, ErrorCat.invalid_payload()}

  defp accepted_changed_fields(fields, accepted) when is_list(fields) do
    fields = Enum.map(fields, &to_string/1)
    accepted = Enum.map(accepted, &to_string/1)

    if Enum.all?(fields, &(&1 in accepted)),
      do: {:ok, Enum.uniq(fields)},
      else: {:error, ErrorCat.undeclared_payload()}
  end

  defp accepted_changed_fields(_, _), do: {:error, ErrorCat.invalid_payload()}

  defp validate_outcome(opts, contract) do
    outcome = Keyword.get(opts, :outcome, :allowed)
    denial_code = Keyword.get(opts, :denial_code)
    outcome_contract = Map.get(contract.outcomes, outcome)

    cond do
      is_nil(outcome_contract) ->
        {:error, ErrorCat.invalid_payload()}

      outcome == :allowed and is_nil(denial_code) ->
        {:ok, %{outcome: :allowed, denial_code: nil}}

      outcome == :denied and outcome_contract.producer_status == :active and
          denial_code in Map.get(outcome_contract, :denial_codes, []) ->
        {:ok, %{outcome: :denied, denial_code: to_string(denial_code)}}

      true ->
        {:error, ErrorCat.invalid_payload()}
    end
  end

  defp accepted_key?(key, accepted) when is_atom(key), do: key in accepted

  defp accepted_key?(key, accepted) when is_binary(key),
    do: key in Enum.map(accepted, &to_string/1)

  defp accepted_key?(_, _), do: false

  defp take_payload(payload, accepted) do
    Map.new(accepted, fn key ->
      {key, Map.get(payload, key, Map.get(payload, to_string(key)))}
    end)
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp validate_target(%{target_type: nil, target_ref: nil}, nil), do: :ok

  defp validate_target(%{target_type: type, target_ref: ref}, expected)
       when not is_nil(expected) and not is_nil(ref) do
    if to_string(type) == to_string(expected),
      do: :ok,
      else: {:error, ErrorCat.invalid_target("target type does not match action contract")}
  end

  defp validate_target(_, _),
    do: {:error, ErrorCat.invalid_target()}

  defp envelope(handler, descriptor, action, opts) do
    source = Keyword.get(opts, :source, :api)
    explicit_event_ref = Keyword.get(opts, :event_ref)

    operation_ref =
      Keyword.get(opts, :operation_ref) || explicit_event_ref || Ecto.UUID.generate()

    operation_index = Keyword.get(opts, :operation_index, 0)
    occurred_at = Keyword.get(opts, :occurred_at, DateTime.utc_now(:second))

    with true <- Const.valid_source?(source) || ErrorCat.invalid_source(),
         {:ok, operation_ref} <- uuid(operation_ref, :operation_ref),
         true <-
           (is_integer(operation_index) and operation_index >= 0) ||
             ErrorCat.invalid_operation_index(),
         {:ok, event_ref} <-
           event_ref(
             explicit_event_ref,
             operation_ref,
             handler,
             descriptor,
             action,
             operation_index
           ),
         {:ok, parent_event_ref} <-
           optional_uuid(Keyword.get(opts, :parent_event_ref), :parent_event_ref),
         true <- match?(%DateTime{}, occurred_at) || ErrorCat.invalid_occurred_at(),
         true <- occurred_at_allowed?(occurred_at) || ErrorCat.invalid_occurred_at(),
         actor when is_map(actor) <- actor_attrs(Keyword.get(opts, :actor, :system)),
         {:ok, on_behalf_of} <- on_behalf_of_attrs(Keyword.get(opts, :on_behalf_of)) do
      {:ok,
       actor
       |> Map.merge(on_behalf_of)
       |> Map.merge(%{
         source: source,
         event_ref: event_ref,
         operation_ref: operation_ref,
         parent_event_ref: parent_event_ref,
         operation_index: operation_index,
         occurred_at: occurred_at
       })}
    else
      %GroupherServer.ErrorCat.Error{} = error -> {:error, error}
      {:error, _} = error -> error
    end
  end

  defp uuid(value, field) do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, uuid_error(field)}
    end
  end

  defp optional_uuid(nil, _field), do: {:ok, nil}
  defp optional_uuid(value, field), do: uuid(value, field)

  defp event_ref(nil, operation_ref, handler, descriptor, action, sequence) do
    identity = {
      operation_ref,
      handler.resource_type(),
      Map.fetch!(descriptor, handler.stream_field()),
      descriptor.subject_ref,
      action,
      sequence
    }

    {:ok, EventRef.derive(identity)}
  end

  defp event_ref(
         explicit,
         _operation_ref,
         _handler,
         _descriptor,
         _action,
         _sequence
       ),
       do: uuid(explicit, :event_ref)

  defp uuid_error(:event_ref), do: ErrorCat.invalid_event_ref()
  defp uuid_error(:operation_ref), do: ErrorCat.invalid_operation_ref()
  defp uuid_error(:parent_event_ref), do: ErrorCat.invalid_parent_event_ref()

  defp normalize_insert({:ok, _log} = result), do: result

  defp normalize_insert({:error, %Ecto.Changeset{} = changeset}) do
    if Enum.any?(changeset.errors, fn
         {:event_ref, {_message, opts}} -> opts[:constraint] == :unique
         _ -> false
       end) do
      {:error, ErrorCat.duplicate_event()}
    else
      {:error, ErrorCat.append_failed(%{fields: Keyword.keys(changeset.errors)})}
    end
  end

  defp insert(schema, attrs) do
    schema
    |> struct()
    |> schema.changeset(attrs)
    |> Repo.insert()
    |> normalize_insert()
  rescue
    Ecto.ConstraintError -> {:error, ErrorCat.append_failed()}
  end

  defp public_user_ref(%{login: login}) when is_binary(login), do: login
  defp public_user_ref(%{id: id}), do: to_string(id)

  defp actor(log) do
    snapshot = atomize_known(log.actor_snapshot || %{}, [:id, :login, :nickname, :avatar])

    if log.actor_type == :system,
      do: %{type: :system},
      else: Map.put(snapshot, :type, :user)
  end

  defp on_behalf_of(%{on_behalf_of_type: nil}), do: nil

  defp on_behalf_of(log) do
    snapshot = atomize_known(log.on_behalf_of_snapshot || %{}, [:id, :login, :nickname, :avatar])
    Map.put(snapshot, :type, log.on_behalf_of_type)
  end

  defp on_behalf_of_attrs(nil),
    do: {:ok, %{on_behalf_of_type: nil, on_behalf_of_ref: nil, on_behalf_of_snapshot: %{}}}

  defp on_behalf_of_attrs(actor) do
    case actor_attrs(actor) do
      %{actor_type: type, actor_ref: ref, actor_snapshot: snapshot} ->
        {:ok, %{on_behalf_of_type: type, on_behalf_of_ref: ref, on_behalf_of_snapshot: snapshot}}

      _ ->
        {:error, ErrorCat.invalid_actor()}
    end
  end

  defp occurred_at_allowed?(%DateTime{} = occurred_at),
    do: DateTime.compare(occurred_at, DateTime.add(DateTime.utc_now(), 60, :second)) != :gt

  defp resource(handler, log) do
    ref(
      handler.resource_type(),
      Map.fetch!(Map.from_struct(log), handler.stream_field()),
      log.stream_snapshot
    )
  end

  defp target(%{target_type: nil}), do: nil
  defp target(log), do: ref(log.target_type, log.target_ref, log.target_snapshot)

  defp ref(type, value, snapshot) do
    %{type: normalize_type(type), ref: value}
    |> Map.merge(atomize_known(snapshot || %{}, [:title, :slug, :inner_id, :node_id, :type]))
  end

  defp normalize_type(value) when is_atom(value), do: value

  defp normalize_type(value) when is_binary(value) do
    try do
      String.to_existing_atom(value)
    rescue
      ArgumentError -> value
    end
  end

  defp atomize_known(map, keys) do
    Map.new(keys, fn key -> {key, Map.get(map, key, Map.get(map, to_string(key)))} end)
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp maybe_put(map, _key, _value, false), do: map
  defp maybe_put(map, key, value, true), do: Map.put(map, key, value)
end
