defmodule GroupherServer.Activity.Event do
  @moduledoc """
  Validates Activity contracts, envelopes and safe projections.

      resource handler -> validated event envelope -> append-only schema
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Activity.{Const, ErrorCat}
  alias GroupherServer.Activity.EventRef
  alias GroupherServer.Repo

  def contract(payload \\ [], metadata \\ [], surfaces \\ [:community_log], target \\ nil) do
    surface_contract = fn surface ->
      fields =
        case surface do
          :article_log ->
            [:actor, :subject, :target, :payload, :occurred_at]

          :community_log ->
            [:resource, :actor, :subject, :target, :source, :payload, :metadata, :occurred_at]
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
        accepted_metadata: metadata
      },
      surfaces: Map.new(surfaces, surface_contract),
      producer_status: :active,
      retention: :long_term
    }
  end

  @doc "Marks a declared event contract that intentionally has no V1 producer."
  def contract_only(contract), do: Map.put(contract, :producer_status, :contract_only)

  def log(handler, resource, action, opts) do
    with :ok <- validate_action(action),
         {:ok, contract} <- fetch_contract(handler, action),
         {:ok, descriptor} <- handler.describe(resource, action, opts),
         {:ok, payload} <-
           accepted_payload(opts[:payload] || %{}, contract.write.accepted_payload),
         {:ok, metadata} <-
           accepted_payload(opts[:metadata] || %{}, contract.write.accepted_metadata),
         :ok <- validate_target(descriptor, contract.write.target_type),
         {:ok, envelope} <- envelope(handler, descriptor, action, opts) do
      attrs =
        descriptor
        |> Map.merge(envelope)
        |> Map.merge(%{action: action, payload: payload, metadata: metadata})

      schema = handler.schema()

      schema
      |> struct()
      |> schema.changeset(attrs)
      |> Repo.insert()
      |> normalize_insert()
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

      base = %{id: log.hash_id, action: log.action}

      result =
        base
        |> maybe_put(:resource, resource(handler, log), :resource in fields)
        |> maybe_put(:actor, actor(log), :actor in fields)
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
        |> maybe_put(:occurred_at, log.occurred_at, :occurred_at in fields)

      {:ok, result}
    else
      :error -> {:error, ErrorCat.surface_not_exposed()}
      error -> error
    end
  end

  def surface_actions(handler, surface) do
    handler.contracts()
    |> Enum.filter(fn {_action, contract} -> Map.has_key?(contract.surfaces, surface) end)
    |> Enum.map(&elem(&1, 0))
  end

  def actor_attrs(%User{} = actor) do
    %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{
        id: public_user_ref(actor),
        login: actor.login,
        nickname: actor.nickname,
        avatar: actor.avatar
      }
    }
  end

  def actor_attrs(:system), do: %{actor_type: :system, actor_id: nil, actor_snapshot: %{}}
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

    event_sequence = Keyword.get(opts, :event_sequence, 0)
    occurred_at = Keyword.get(opts, :occurred_at, DateTime.utc_now(:second))

    with true <- Const.valid_source?(source) || ErrorCat.invalid_source(),
         {:ok, operation_ref} <- uuid(operation_ref, :operation_ref),
         true <-
           (is_integer(event_sequence) and event_sequence >= 0) ||
             ErrorCat.invalid_event_sequence(),
         {:ok, event_ref} <-
           event_ref(
             explicit_event_ref,
             operation_ref,
             handler,
             descriptor,
             action,
             event_sequence
           ),
         {:ok, parent_event_ref} <-
           optional_uuid(Keyword.get(opts, :parent_event_ref), :parent_event_ref),
         true <- match?(%DateTime{}, occurred_at) || ErrorCat.invalid_occurred_at(),
         actor when is_map(actor) <- actor_attrs(Keyword.get(opts, :actor, :system)) do
      {:ok,
       Map.merge(actor, %{
         source: source,
         event_ref: event_ref,
         operation_ref: operation_ref,
         parent_event_ref: parent_event_ref,
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

  defp public_user_ref(%{login: login}) when is_binary(login), do: login
  defp public_user_ref(%{id: id}), do: to_string(id)

  defp actor(log) do
    snapshot = atomize_known(log.actor_snapshot || %{}, [:id, :login, :nickname, :avatar])

    if log.actor_type == :system,
      do: %{type: :system},
      else: Map.put(snapshot, :type, :user)
  end

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
