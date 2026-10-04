defmodule GroupherServer.CMS.Command.Receipt.Store do
  @moduledoc """
  Persists command claims, finalized recovery envelopes and retention cleanup.

      Runner
        -> Store claim / finalize
        -> CMS.Model.CommandReceipt
        -> Repo
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Model.CommandReceipt

  @receipt_ttl_seconds 24 * 60 * 60
  @identity_ttl_seconds 30 * 24 * 60 * 60
  @type claim_result :: :new | :recovery

  @doc "Claims a command identity in the caller's transaction."
  @spec claim(
          String.t(),
          Ecto.UUID.t(),
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term()
        ) :: {:ok, claim_result(), CommandReceipt.t()} | {:error, term()}
  def claim(
        initiator_key,
        command_id,
        command,
        resource_type,
        resource_id,
        intent_params \\ nil
      )
      when is_binary(initiator_key) and is_binary(command_id) and is_binary(command) and
             is_binary(resource_type) and
             (is_binary(resource_id) or is_integer(resource_id)) do
    resource_id = to_string(resource_id)

    with {:ok, canonical} <- canonical_input(intent_params) do
      attrs = %{
        initiator_type: "user",
        initiator_key: initiator_key,
        command_id: command_id,
        command: command,
        resource_type: resource_type,
        resource_id: resource_id,
        intent_params: params_envelope(canonical),
        confirmation: nil,
        expires_at: expires_at(),
        identity_expires_at: identity_expires_at()
      }

      insert_claim(attrs)
    end
  end

  @doc "Finalizes a claimed receipt with its recovery metadata."
  @spec finalize(CommandReceipt.t(), map()) ::
          {:ok, CommandReceipt.t()} | {:error, Ecto.Changeset.t()}
  def finalize(%CommandReceipt{} = receipt, attrs) when is_map(attrs) do
    attrs = Map.take(attrs, [:confirmation])

    receipt
    |> Ecto.Changeset.change(attrs)
    |> Repo.update()
  end

  @doc "Compacts expired results and deletes receipts past the identity window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000) when is_integer(limit) and limit > 0 do
    now = DateTime.utc_now()

    tombstone_ids =
      from(receipt in CommandReceipt,
        where:
          (is_nil(receipt.identity_expires_at) and receipt.expires_at <= ^now) or
            receipt.identity_expires_at <= ^now,
        order_by: [asc: receipt.identity_expires_at, asc: receipt.id],
        limit: ^limit,
        select: receipt.id
      )

    {deleted, _} =
      Repo.delete_all(
        from(receipt in CommandReceipt,
          where: receipt.id in subquery(tombstone_ids)
        )
      )

    compacted =
      if deleted < limit do
        compact_ids =
          from(receipt in CommandReceipt,
            where:
              receipt.expires_at <= ^now and
                not is_nil(receipt.identity_expires_at) and
                receipt.identity_expires_at > ^now,
            order_by: [asc: receipt.expires_at, asc: receipt.id],
            limit: ^(limit - deleted),
            select: receipt.id
          )

        {updated, _} =
          Repo.update_all(
            from(receipt in CommandReceipt,
              where: receipt.id in subquery(compact_ids)
            ),
            set: [confirmation: nil]
          )

        updated
      else
        0
      end

    deleted + compacted
  end

  defp insert_claim(attrs), do: insert_claim(attrs, 0)

  defp insert_claim(attrs, attempts) do
    changeset = CommandReceipt.changeset(%CommandReceipt{}, attrs)

    case Repo.insert(
           changeset,
           on_conflict: :nothing,
           conflict_target: [:initiator_type, :initiator_key, :command_id]
         ) do
      {:ok, %CommandReceipt{id: id} = receipt} when not is_nil(id) ->
        {:ok, :new, receipt}

      {:ok, _conflict_placeholder} ->
        resolve_conflict(attrs, attempts)

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}
    end
  end

  defp resolve_conflict(attrs, attempts) do
    key = %{
      initiator_type: attrs.initiator_type,
      initiator_key: attrs.initiator_key,
      command_id: attrs.command_id
    }

    case Repo.one(
           from(receipt in CommandReceipt,
             where:
               receipt.initiator_type == ^key.initiator_type and
                 receipt.initiator_key == ^key.initiator_key and
                 receipt.command_id == ^key.command_id,
             lock: "FOR UPDATE"
           )
         ) do
      %CommandReceipt{} = receipt ->
        cond do
          identity_expired?(receipt) ->
            Repo.delete!(receipt)
            insert_claim(attrs, attempts + 1)

          result_expired?(receipt.expires_at) ->
            {:error, conflict_or_expired(receipt, attrs)}

          is_nil(receipt.confirmation) ->
            {:error, ErrorCat.command_result_unavailable()}

          same_intent?(receipt, attrs) ->
            {:ok, :recovery, receipt}

          true ->
            {:error, conflict_error(receipt, attrs)}
        end

      nil ->
        if attempts < 1 do
          insert_claim(attrs, attempts + 1)
        else
          {:error, ErrorCat.command_resolution_pending()}
        end
    end
  end

  # Actor context is resolved from authentication and must not make a retry
  # conflict merely because the server loaded a different User struct.
  defp canonical_input(data) when is_map(data) and not is_struct(data) do
    data
    |> Map.drop([:actor, :actor_id, :cur_user, :current_user])
    |> canonical_map()
  end

  defp canonical_input(data) when is_list(data) do
    if Keyword.keyword?(data) do
      keys = Keyword.keys(data)

      if length(keys) == length(Enum.uniq(keys)) do
        data
        |> Keyword.drop([:actor, :actor_id, :cur_user, :current_user])
        |> Map.new()
        |> canonical_input()
      else
        {:error, :invalid_intent_params}
      end
    else
      canonical_list(data)
    end
  end

  defp canonical_input(nil), do: {:ok, nil}

  defp canonical_input(%DateTime{} = value), do: {:ok, DateTime.to_iso8601(value)}
  defp canonical_input(%NaiveDateTime{} = value), do: {:ok, NaiveDateTime.to_iso8601(value)}
  defp canonical_input(%Date{} = value), do: {:ok, Date.to_iso8601(value)}

  defp canonical_input(value) when is_binary(value) or is_number(value) or is_boolean(value),
    do: {:ok, value}

  defp canonical_input(value) when is_atom(value), do: {:ok, Atom.to_string(value)}

  defp canonical_input(_data), do: {:error, :invalid_intent_params}

  defp canonical_map(map) do
    map
    |> Enum.sort_by(fn {key, _value} -> inspect(key) end)
    |> Enum.reduce_while(%{}, fn {key, value}, acc ->
      with {:ok, canonical_key} <- canonical_key(key),
           {:ok, normalized} <- canonical_input(value) do
        if Map.has_key?(acc, canonical_key),
          do: {:halt, {:error, :invalid_intent_params}},
          else: {:cont, Map.put(acc, canonical_key, normalized)}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:error, reason} -> {:error, reason}
      normalized -> {:ok, normalized}
    end
  end

  defp canonical_key(key) when is_binary(key), do: {:ok, key}
  defp canonical_key(key) when is_atom(key), do: {:ok, Atom.to_string(key)}
  defp canonical_key(_key), do: {:error, :invalid_intent_params}

  defp canonical_list(list) do
    Enum.reduce_while(list, [], fn value, acc ->
      case canonical_input(value) do
        {:ok, normalized} -> {:cont, [normalized | acc]}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:error, reason} -> {:error, reason}
      normalized -> {:ok, Enum.reverse(normalized)}
    end
  end

  defp params_envelope(value) when is_map(value), do: value
  defp params_envelope(value), do: %{"$value" => value}

  defp expires_at, do: DateTime.add(DateTime.utc_now(), @receipt_ttl_seconds, :second)

  defp identity_expires_at,
    do: DateTime.add(DateTime.utc_now(), @identity_ttl_seconds, :second)

  defp same_intent?(%CommandReceipt{} = receipt, attrs) do
    receipt.command == attrs.command and
      receipt.resource_type == attrs.resource_type and
      receipt.resource_id == attrs.resource_id and
      receipt.intent_params == attrs.intent_params
  end

  defp conflict_or_expired(receipt, attrs) do
    if same_intent?(receipt, attrs),
      do: ErrorCat.command_result_expired(),
      else: conflict_error(receipt, attrs)
  end

  defp conflict_error(receipt, attrs) do
    ErrorCat.command_id_conflict(intent_diff(receipt, attrs))
  end

  defp intent_diff(%CommandReceipt{} = receipt, attrs) do
    different_fields =
      if is_map(receipt.intent_params) and is_map(attrs.intent_params) do
        receipt.intent_params
        |> Map.keys()
        |> Kernel.++(Map.keys(attrs.intent_params))
        |> Enum.uniq()
        |> Enum.filter(fn key ->
          Map.get(receipt.intent_params, key) != Map.get(attrs.intent_params, key)
        end)
        |> Enum.map(&to_string/1)
        |> Enum.sort()
      else
        []
      end

    %{different_fields: different_fields}
  end

  defp result_expired?(%DateTime{} = expires_at),
    do: DateTime.compare(expires_at, DateTime.utc_now()) == :lt

  defp identity_expired?(%CommandReceipt{identity_expires_at: nil} = receipt),
    do: result_expired?(receipt.expires_at)

  defp identity_expired?(%CommandReceipt{identity_expires_at: expires_at}),
    do: DateTime.compare(expires_at, DateTime.utc_now()) == :lt
end
