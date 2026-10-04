defmodule GroupherServer.CMS.Command.Receipt.Runner do
  @moduledoc """
  Executes one CMS command inside the shared claim, execute, finalize transaction.

      user command
        -> claim or recover
        -> domain callback
        -> finalize
        -> commit or rollback

  Gate, Lifecycle and domain writes remain inside the callback supplied by the
  owning CMS context.
  """

  require Logger

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.ErrorCat
  alias CMS.Command
  alias CMS.Command.Confirmation, as: ConfirmationCodec
  alias CMS.Command.IntentCodec

  alias Accounts.Model.User
  alias CMS.Command.Receipt.{Key, Store}
  # Claim conflict resolution must not wait forever on a transaction that is
  # still holding the unique-key row or an article mutation lock. The lock
  # budget is deliberately shorter than the enclosing transaction budget so a
  # caller can retry or reconcile from the receipt instead of hanging.
  @database_lock_timeout_ms 4_000
  @database_transaction_timeout_ms 30_000
  @confirmation_max_bytes Application.compile_env(
                            :groupher_server,
                            :command_confirmation_max_bytes,
                            64 * 1024
                          )

  @doc false
  @spec execute(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> term()),
          module()
        ) :: {:ok, term()} | {:error, term()}
  def execute(
        user,
        command_id,
        command,
        resource_type,
        resource_id,
        data,
        execute,
        confirmation
      ),
      do:
        execute(
          user,
          command_id,
          command,
          resource_type,
          resource_id,
          data,
          execute,
          confirmation,
          nil
        )

  def execute(
        %User{},
        nil,
        _command,
        _resource_type,
        _resource_id,
        _data,
        _execute,
        _result,
        _presenter
      ),
      do: {:error, ErrorCat.command_id_required()}

  def execute(
        %User{id: user_id},
        command_id,
        command,
        resource_type,
        resource_id,
        data,
        execute,
        confirmation,
        presenter
      )
      when is_binary(command_id) do
    with {:ok, command_id} <- Key.validate(command_id),
         {:ok, intent_params} <- IntentCodec.encode_tag(command, data) do
      validate_callbacks!(execute, confirmation)

      execute_command(
        Integer.to_string(user_id),
        command_id,
        command,
        resource_type,
        resource_id,
        intent_params,
        execute,
        confirmation,
        presenter
      )
    end
  end

  def execute(
        %User{},
        _command_id,
        _command,
        _resource_type,
        _resource_id,
        _data,
        _execute,
        _result,
        _presenter
      ),
      do: {:error, ErrorCat.command_id_invalid()}

  defp execute_command(
         initiator_key,
         command_id,
         command,
         resource_type,
         resource_id,
         data,
         execute,
         confirmation,
         presenter
       )
       when is_binary(initiator_key) and is_binary(command_id) and
              is_function(execute, 0) and is_atom(confirmation) do
    case execute_receipt_transaction(fn ->
           configure_claim_timeout!()

           case Store.claim(
                  initiator_key,
                  command_id,
                  command,
                  resource_type,
                  resource_id,
                  data
                ) do
             {:ok, :recovery, receipt} ->
               configure_transaction_timeouts!()

               resolve_confirmation(receipt, confirmation, presenter)

             {:ok, :new, receipt} ->
               configure_transaction_timeouts!()
               execute_and_finalize(receipt, execute, confirmation, presenter)

             {:error, reason} ->
               Repo.rollback(reason)
           end
         end) do
      {:ok, {_state, result}} ->
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp validate_callbacks!(execute, confirmation) do
    unless is_function(execute, 0) and is_atom(confirmation) do
      raise ArgumentError,
            "command receipt callbacks must be execute/0 and a confirmation module"
    end
  end

  # The runner never inspects domain result shapes. Each domain owner supplies
  # the typed, versioned Confirmation codec used by execution and replay.
  defp execute_and_finalize(receipt, execute, confirmation, presenter)
       when is_atom(confirmation) do
    case execute.() do
      {:ok, value, action_context} ->
        finalize_confirmation(receipt, confirmation, value, action_context, presenter)

      {:ok, value} ->
        finalize_confirmation(receipt, confirmation, value, nil, presenter)

      {:error, reason} ->
        Repo.rollback(reason)

      other ->
        Repo.rollback({:invalid_command_result, other})
    end
  end

  defp finalize_confirmation(receipt, confirmation, value, action_context, presenter) do
    with {:ok, payload} <- encode_confirmation(confirmation, value, receipt.command),
         :ok <- validate_confirmation_tag(payload, receipt.command),
         {:ok, _finalized_receipt} <- Store.finalize(receipt, %{confirmation: payload}),
         {:ok, decoded} <- decode_confirmation(confirmation, payload, receipt.command),
         {:ok, presented} <- present(presenter, decoded, :executed, action_context) do
      {:executed, presented}
    else
      {:error, %Ecto.Changeset{} = changeset} -> Repo.rollback(changeset)
      {:error, reason} -> Repo.rollback({:invalid_command_result, reason})
      other -> Repo.rollback({:invalid_command_result, other})
    end
  end

  defp resolve_confirmation(receipt, module, presenter) when is_atom(module) do
    with payload when is_map(payload) <- receipt.confirmation,
         {:ok, _size} <- confirmation_size(payload),
         {:ok, tag} <- Map.fetch(payload, "operation"),
         true <- tag == receipt.command,
         {:ok, decoded} <- decode_confirmation(module, payload, receipt.command),
         {:ok, presented} <- present(presenter, decoded, :recovered, nil) do
      {:recovered, presented}
    else
      reason ->
        Logger.error("command confirmation recovery failed",
          reason: inspect(reason),
          receipt_id: receipt.id,
          command: receipt.command,
          confirmation_bytes: confirmation_size_value(receipt.confirmation)
        )

        Repo.rollback(ErrorCat.command_result_unavailable())
    end
  end

  defp present(nil, decoded, _state, _action_context), do: {:ok, decoded}

  defp present(presenter, decoded, state, action_context) when is_function(presenter, 2) do
    case presenter.(decoded, %{state: state, action_context: action_context}) do
      {:ok, value} -> {:ok, value}
      {:error, reason} -> {:error, reason}
      value -> {:ok, value}
    end
  rescue
    error -> {:error, {:presenter_failed, error}}
  end

  defp encode_confirmation(module, value, operation) do
    with {:ok, operation_atom} <- Command.operation_from_tag(operation),
         true <- match?(%{__struct__: ^module}, value) do
      case module.encode(value, operation_atom) do
        {:ok, payload} when is_map(payload) ->
          with true <- ConfirmationCodec.json_safe?(payload),
               {:ok, bytes} <- confirmation_size(payload),
               :ok <- validate_confirmation_size(bytes, operation) do
            emit_confirmation_telemetry(:encoded, operation, bytes, payload)
            {:ok, payload}
          else
            false ->
              {:error, :invalid_confirmation_encoding}

            {:error, reason} ->
              emit_confirmation_telemetry(:rejected, operation, nil, %{})
              {:error, reason}
          end

        {:error, reason} ->
          {:error, reason}

        _ ->
          {:error, :invalid_confirmation_encoding}
      end
    else
      false -> {:error, :confirmation_struct_mismatch}
      {:error, reason} -> {:error, reason}
    end
  rescue
    _ -> {:error, :invalid_confirmation_encoding}
  end

  defp decode_confirmation(module, payload, operation) do
    with {:ok, operation_atom} <- Command.operation_from_tag(operation) do
      case module.decode(payload, operation_atom) do
        {:ok, %{__struct__: ^module} = value} -> {:ok, value}
        {:error, _reason} -> {:error, :confirmation_decode_failed}
        _ -> {:error, :confirmation_struct_mismatch}
      end
    end
  rescue
    _ -> {:error, :confirmation_decode_failed}
  end

  defp validate_confirmation_tag(%{"operation" => tag}, command),
    do: if(tag == command, do: :ok, else: {:error, :confirmation_operation_mismatch})

  defp validate_confirmation_tag(_payload, _command),
    do: {:error, :confirmation_operation_missing}

  defp confirmation_size(payload) when is_map(payload) do
    case Jason.encode(payload) do
      {:ok, encoded} -> {:ok, byte_size(encoded)}
      {:error, _reason} -> {:error, :invalid_confirmation_encoding}
    end
  end

  defp confirmation_size(_payload), do: {:error, :invalid_confirmation_encoding}

  defp confirmation_size_value(payload) do
    case confirmation_size(payload) do
      {:ok, bytes} -> bytes
      {:error, _reason} -> nil
    end
  end

  defp validate_confirmation_size(bytes, _operation) when bytes <= @confirmation_max_bytes,
    do: :ok

  defp validate_confirmation_size(_bytes, _operation),
    do: {:error, :confirmation_payload_too_large}

  defp emit_confirmation_telemetry(status, operation, bytes, payload) do
    :telemetry.execute(
      [:groupher, :cms, :command, :confirmation],
      %{count: 1, bytes: bytes || 0},
      %{
        status: status,
        operation: operation,
        schema_version: Map.get(payload, "schema_version")
      }
    )
  end

  defp execute_receipt_transaction(fun) when is_function(fun, 0) do
    case Repo.transaction(
           fn ->
             configure_transaction_timeouts!()
             fun.()
           end,
           timeout: @database_transaction_timeout_ms
         ) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, normalize_transaction_error(reason)}
    end
  rescue
    reason in Postgrex.Error ->
      {:error, normalize_transaction_error(reason)}

    reason in DBConnection.ConnectionError ->
      Logger.error("Command receipt transaction lost its database connection",
        reason: Exception.message(reason)
      )

      {:error, normalize_transaction_error(reason)}
  end

  defp configure_transaction_timeouts! do
    configure_timeouts!(@database_transaction_timeout_ms, @database_lock_timeout_ms)
  end

  defp configure_claim_timeout! do
    configure_timeouts!(@database_lock_timeout_ms, @database_lock_timeout_ms)
  end

  defp configure_timeouts!(statement_timeout_ms, lock_timeout_ms) do
    Repo.query!("SELECT set_config('statement_timeout', $1, true)", [
      "#{statement_timeout_ms}ms"
    ])

    Repo.query!("SELECT set_config('lock_timeout', $1, true)", [
      "#{lock_timeout_ms}ms"
    ])
  end

  defp normalize_transaction_error(%Postgrex.Error{postgres: %{code: code}})
       when code in [:lock_not_available, :query_canceled],
       do: ErrorCat.command_resolution_pending()

  defp normalize_transaction_error(%DBConnection.ConnectionError{}),
    do: ErrorCat.command_resolution_pending()

  defp normalize_transaction_error(reason), do: reason
end
