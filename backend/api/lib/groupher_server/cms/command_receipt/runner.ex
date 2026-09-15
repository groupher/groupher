defmodule GroupherServer.CMS.CommandReceipt.Runner do
  @moduledoc """
  Runs one CMS command inside the shared claim, execute, finalize transaction.

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

  alias Accounts.Model.User
  alias CMS.CommandReceipt.{Key, Store}
  alias CMS.Model.CommandReceipt

  # Claim conflict resolution must not wait forever on a transaction that is
  # still holding the unique-key row or an article mutation lock. The lock
  # budget is deliberately shorter than the enclosing transaction budget so a
  # caller can retry or reconcile from the receipt instead of hanging.
  @database_lock_timeout_ms 4_000
  @database_transaction_timeout_ms 30_000

  @doc false
  @spec run_internal(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> term()),
          (CommandReceipt.t() -> term())
        ) :: {:ok, term()} | {:error, term()}
  def run_internal(
        %User{},
        nil,
        _command,
        _target_type,
        _target_key,
        _data,
        _execute,
        _recovery
      ),
      do: {:error, ErrorCat.command_id_required()}

  def run_internal(
        user,
        command_id,
        command,
        target_type,
        target_key,
        data,
        execute,
        recovery
      ),
      do:
        run_internal(
          user,
          command_id,
          command,
          target_type,
          target_key,
          data,
          execute,
          recovery,
          fn _result -> :ok end
        )

  def run_internal(
        %User{},
        nil,
        _command,
        _target_type,
        _target_key,
        _data,
        _execute,
        _recovery,
        _after_commit
      ),
      do: {:error, ErrorCat.command_id_required()}

  def run_internal(
        %User{id: user_id},
        command_id,
        command,
        target_type,
        target_key,
        data,
        execute,
        recovery,
        after_commit
      )
      when is_binary(command_id) do
    with {:ok, command_id} <- Key.resolve(command_id) do
      validate_callbacks!(execute, recovery, after_commit)

      run_command(
        Integer.to_string(user_id),
        command_id,
        command,
        target_type,
        target_key,
        data,
        execute,
        recovery,
        after_commit
      )
    end
  end

  def run_internal(
        %User{},
        _command_id,
        _command,
        _target_type,
        _target_key,
        _data,
        _execute,
        _recovery,
        _after_commit
      ),
      do: {:error, ErrorCat.command_id_invalid()}

  defp run_command(
         initiator_key,
         command_id,
         command,
         target_type,
         target_key,
         data,
         execute,
         recovery,
         after_commit
       )
       when is_binary(initiator_key) and is_binary(command_id) and
              is_function(execute, 0) and is_function(recovery, 1) and
              is_function(after_commit, 1) do
    case run_receipt_transaction(fn ->
           configure_claim_timeout!()

           case Store.claim(
                  initiator_key,
                  command_id,
                  command,
                  target_type,
                  target_key,
                  data
                ) do
             {:ok, :recovery, receipt} ->
               configure_transaction_timeouts!()

               case recovery.(receipt) do
                 {:ok, result} -> {:recovered, result}
                 {:error, reason} -> Repo.rollback(reason)
               end

             {:ok, :new, receipt} ->
               configure_transaction_timeouts!()
               execute_and_finalize(receipt, target_key, execute)

             {:error, reason} ->
               Repo.rollback(reason)
           end
         end) do
      {:ok, {:executed, result}} ->
        _ = after_commit.(result)
        {:ok, result}

      {:ok, {:recovered, result}} ->
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp validate_callbacks!(execute, recovery, after_commit) do
    unless is_function(execute, 0) and is_function(recovery, 1) and is_function(after_commit, 1) do
      raise ArgumentError,
            "command receipt callbacks must be execute/0, recovery/1 and after_commit/1 functions"
    end
  end

  # The runner never inspects domain result shapes. Simple commands may use the
  # target key as their recovery key; composite results must provide explicit,
  # versioned metadata whose encoder and decoder live at the domain owner.
  defp execute_and_finalize(receipt, target_key, execute) do
    case execute.() do
      {:ok, result} ->
        finalize_execution(receipt, result, target_key, %{})

      {:ok, result, metadata} when is_map(metadata) ->
        finalize_execution(receipt, result, target_key, metadata)

      {:error, reason} ->
        Repo.rollback(reason)

      other ->
        Repo.rollback({:invalid_command_result, other})
    end
  end

  defp finalize_execution(receipt, result, target_key, metadata) do
    attrs =
      metadata
      |> Map.put_new(:outcome, :changed)
      |> Map.put_new(:result_key, target_key)
      |> Map.put_new(:result_payload, nil)

    case Store.finalize(receipt, attrs) do
      {:ok, _receipt} -> {:executed, result}
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp run_receipt_transaction(fun) when is_function(fun, 0) do
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
