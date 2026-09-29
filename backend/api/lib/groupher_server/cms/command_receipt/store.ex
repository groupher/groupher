defmodule GroupherServer.CMS.CommandReceipt.Store do
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
        target_type,
        target_key,
        fingerprint_data \\ nil
      )
      when is_binary(initiator_key) and is_binary(command_id) and is_binary(command) and
             is_binary(target_type) and
             (is_binary(target_key) or is_integer(target_key)) do
    target_key = to_string(target_key)
    fingerprint = fingerprint(command, target_type, target_key, fingerprint_data)

    attrs = %{
      initiator_type: "user",
      initiator_key: initiator_key,
      command_id: command_id,
      command: command,
      target_type: target_type,
      target_key: target_key,
      payload_fingerprint: fingerprint,
      expires_at: expires_at()
    }

    insert_claim(attrs, fingerprint)
  end

  @doc "Finalizes a claimed receipt with its recovery metadata."
  @spec finalize(CommandReceipt.t(), map()) ::
          {:ok, CommandReceipt.t()} | {:error, Ecto.Changeset.t()}
  def finalize(%CommandReceipt{} = receipt, attrs) when is_map(attrs) do
    attrs =
      attrs
      |> Map.take([:outcome, :result_key, :result_payload])
      |> Map.update(:outcome, nil, &if(is_nil(&1), do: nil, else: to_string(&1)))
      |> Map.update(:result_key, nil, &if(is_nil(&1), do: nil, else: to_string(&1)))

    receipt
    |> Ecto.Changeset.change(attrs)
    |> Repo.update()
  end

  @doc "Deletes a bounded batch of receipts past the recovery window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000) when is_integer(limit) and limit > 0 do
    now = DateTime.utc_now()

    expired_ids =
      from(receipt in CommandReceipt,
        where: receipt.expires_at <= ^now,
        order_by: [asc: receipt.expires_at, asc: receipt.id],
        limit: ^limit,
        select: receipt.id
      )

    {deleted, _} =
      Repo.delete_all(
        from(receipt in CommandReceipt,
          where: receipt.id in subquery(expired_ids)
        )
      )

    deleted
  end

  defp insert_claim(attrs, fingerprint) do
    changeset = CommandReceipt.changeset(%CommandReceipt{}, attrs)

    case Repo.insert(
           changeset,
           on_conflict: :nothing,
           conflict_target: [:initiator_type, :initiator_key, :command_id]
         ) do
      {:ok, %CommandReceipt{id: id} = receipt} when not is_nil(id) ->
        {:ok, :new, receipt}

      {:ok, _conflict_placeholder} ->
        resolve_conflict(attrs, fingerprint)

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}
    end
  end

  defp resolve_conflict(attrs, fingerprint) do
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
        if expired?(receipt.expires_at) do
          Repo.delete!(receipt)
          insert_claim(attrs, fingerprint)
        else
          case receipt.payload_fingerprint do
            ^fingerprint -> {:ok, :recovery, receipt}
            _ -> {:error, ErrorCat.command_id_conflict()}
          end
        end

      nil ->
        {:error, ErrorCat.command_id_conflict()}
    end
  end

  defp fingerprint(command, target_type, target_key, data) do
    :crypto.hash(
      :sha256,
      :erlang.term_to_binary({command, target_type, target_key, canonical_input(data)})
    )
    |> Base.encode16(case: :lower)
  end

  # Actor context is resolved from authentication and must not make a retry
  # conflict merely because the server loaded a different User struct.
  defp canonical_input(data) when is_map(data) and not is_struct(data),
    do: Map.drop(data, [:actor, :actor_id, :cur_user, :current_user])

  defp canonical_input(data) when is_list(data) do
    if Keyword.keyword?(data),
      do: Keyword.drop(data, [:actor, :actor_id, :cur_user, :current_user]),
      else: data
  end

  defp canonical_input(data), do: data

  defp expires_at, do: DateTime.add(DateTime.utc_now(), @receipt_ttl_seconds, :second)

  defp expired?(%DateTime{} = expires_at),
    do: DateTime.compare(expires_at, DateTime.utc_now()) == :lt
end
