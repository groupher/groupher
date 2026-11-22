defmodule GroupherServer.CommandPipeline.Runner do
  @moduledoc """
  Executes the stages emitted by `GroupherServer.CommandPipeline`.

  The runner, not a business command, owns the top-level transaction. Gate
  callbacks are the only stage allowed to use the join-only Gate API. The
  runner publishes the current stage through `StageContext`, so Gate can
  enforce that rule at runtime. Domain workflows remain ordinary functions
  invoked by the top-level pipeline's `change` stage.

      public Command
        -> Pipeline.Runner
        -> Receipt or direct transaction
        -> canonical domain result
  """

  require Logger

  alias GroupherServer.{CommandPipeline, Repo}

  alias CommandPipeline.{
    Rejected,
    RejectionContext,
    RejectionData,
    RejectionLog,
    StageContext
  }

  @runner_key {__MODULE__, :active}

  @doc false
  def build_input(arguments, contract) when is_map(arguments) and is_map(contract) do
    %{
      actor: argument(arguments, contract.actor),
      command_id: argument(arguments, contract.command_id),
      operation_ref: argument(arguments, Map.get(contract, :operation_ref)),
      operation: contract.operation,
      target: Map.fetch!(arguments, contract.target),
      params: params(arguments, contract.params),
      arguments: arguments
    }
  end

  @doc "Executes a receipt pipeline through the existing Receipt boundary."
  def run_receipt(module, contract, input, stages) do
    adapter = adapter_for(contract)

    with {:ok, input} <- run_prepare(input, stages),
         {:ok, command_id} <- adapter.validate_command_id(input.command_id) do
      result =
        case run_receipt_command(module, contract, input, command_id, stages) do
          {:ok, confirmation} ->
            run_present(confirmation, input, stages)

          {:error, {:cms_command_pipeline_rejection, stage, reason, operation_ref}} ->
            rejection_result(stage, reason, input, contract, stages, operation_ref)

          {:error, {:pipeline_stage, stage, reason}} ->
            rejection_result(stage, reason, input, contract, stages, nil)

          {:error, _reason} = error ->
            error
        end

      run_cleanup(result, input, stages)
    else
      {:error, _reason} = error ->
        error
    end
  end

  @doc "Executes a direct pipeline with a fresh per-attempt operation reference."
  def run_direct(module, contract, input, stages) do
    operation_ref =
      case input.operation_ref do
        nil -> Ecto.UUID.generate()
        value -> value
      end

    with {:ok, operation_ref} <- validate_operation_ref(operation_ref) do
      run_direct_with_operation_ref(module, contract, input, stages, operation_ref)
    end
  end

  defp run_direct_with_operation_ref(module, contract, input, stages, operation_ref) do
    input = Map.put(input, :operation_ref, operation_ref)

    with {:ok, input} <- run_prepare(input, stages) do
      result =
        case run_direct_transaction(module, contract, operation_ref, input, stages) do
          {:ok, value} ->
            run_present(value, input, stages)

          {:error, {:pipeline_stage, stage, reason}} ->
            rejection_result(
              stage,
              reason,
              input,
              contract,
              stages,
              operation_ref
            )

          {:error, reason} ->
            {:error, reason}
        end

      run_cleanup(result, input, stages)
    else
      {:error, _reason} = error -> error
    end
  end

  defp run_receipt_command(module, contract, input, command_id, stages) do
    adapter_for(contract).execute_receipt(module, contract, input, command_id, fn operation_ref ->
      set_active(module, contract, operation_ref, :top_level)

      try do
        with {:ok, current} <- initial_value(input, stages),
             {:ok, result} <-
               run_stages(current, stages, operation_ref, [
                 :prepare,
                 :present,
                 :on_rejection,
                 :cleanup
               ]) do
          {:ok, result}
        end
      after
        clear_active()
      end
    end)
  end

  defp run_prepare(input, stages) do
    case Keyword.get(stages, :prepare) do
      nil ->
        {:ok, input}

      callback ->
        case StageContext.run(:prepare, callback) do
          {:ok, value, target: target, params: params} ->
            {:ok,
             input
             |> Map.put(:prepared, value)
             |> Map.put(:target, target)
             |> Map.put(:params, params)}

          {:ok, value, target: target} ->
            {:ok, input |> Map.put(:prepared, value) |> Map.put(:target, target)}

          {:ok, value} ->
            {:ok, Map.put(input, :prepared, value)}

          {:error, reason} ->
            {:error, reason}

          other ->
            {:error, {:pipeline_invalid_result, :prepare, other}}
        end
    end
  end

  defp initial_value(input, _stages) do
    {:ok, Map.get(input, :prepared, input.target)}
  end

  defp run_stages(current, stages, operation_ref, skip) do
    stages
    |> Enum.reject(fn {stage, _callback} -> stage in skip end)
    |> Enum.reduce_while({:ok, current}, fn {stage, callback}, {:ok, value} ->
      result =
        StageContext.run(stage, fn ->
          cond do
            stage in [:load, :prepare] -> callback.()
            stage == :change -> callback.(value, operation_ref)
            true -> callback.(value)
          end
        end)

      case result do
        {:ok, next} ->
          {:cont, {:ok, next}}

        {:error, {:pipeline_stage, nested_stage, nested_reason}} ->
          {:halt, stage_error(nested_stage, nested_reason)}

        {:error, reason} ->
          {:halt, stage_error(stage, reason)}

        other ->
          {:halt, {:error, {:pipeline_invalid_result, stage, other}}}
      end
    end)
  end

  defp run_present(value, _input, stages) do
    case Keyword.get(stages, :present) do
      nil ->
        {:ok, value}

      callback ->
        case StageContext.run(:present, fn -> callback.(value) end) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> {:error, reason}
          other -> {:error, {:pipeline_invalid_result, :present, other}}
        end
    end
  end

  defp run_cleanup({:ok, _value} = result, _input, _stages), do: result

  defp run_cleanup({:error, reason} = result, input, stages) do
    case Keyword.get(stages, :cleanup) do
      nil ->
        result

      callback ->
        try do
          _ = StageContext.run(:cleanup, fn -> callback.(%{error: reason, input: input}) end)
          result
        rescue
          exception ->
            emit_rejection_telemetry(%{
              kind: :cleanup_exception,
              exception: exception,
              stacktrace: __STACKTRACE__
            })

            result
        end
    end
  end

  defp rejection_result(stage, reason, input, contract, stages, operation_ref) do
    public_error = {:error, Rejected.unwrap(reason)}

    if should_run_rejection?(reason) and is_binary(operation_ref) do
      run_rejection(stage, reason, input, contract, stages, operation_ref)
    else
      public_error
    end
  end

  defp run_rejection(stage, reason, input, contract, stages, operation_ref) do
    failure = %{
      stage: stage,
      code: rejection_code(reason),
      error: Rejected.unwrap(reason),
      operation: contract.operation,
      operation_ref: operation_ref,
      input: input
    }

    cond do
      is_function(Keyword.get(stages, :on_rejection), 1) ->
        run_on_rejection(Keyword.fetch!(stages, :on_rejection), failure, contract)

      true ->
        emit_rejection_telemetry(%{kind: :missing_builder, stage: stage})
    end

    {:error, failure.error}
  end

  defp run_on_rejection(callback, failure, contract) do
    emit_rejection_telemetry(%{
      kind: :rejection,
      stage: failure.stage,
      code: failure.code,
      operation: failure.operation,
      operation_ref: failure.operation_ref
    })

    context = %RejectionContext{
      stage: failure.stage,
      error: failure.error,
      operation: failure.operation,
      operation_ref: failure.operation_ref,
      arguments: failure.input.arguments
    }

    with {:ok, data} <- build_rejection_data(callback, context),
         {:ok, log} <- rejection_log(data, contract, failure),
         {:ok, result} <- write_rejection(log, contract) do
      result
    else
      {:error, reason} ->
        emit_rejection_telemetry(%{kind: :rejection_write_error, reason: reason})
        {:error, :rejection_write_failed}
    end
  end

  defp build_rejection_data(callback, context) do
    try do
      case StageContext.run(:on_rejection, fn -> callback.(context) end) do
        %RejectionData{} = data -> validate_rejection_data(data)
        other -> {:error, {:invalid_rejection_data, other}}
      end
    rescue
      exception ->
        emit_rejection_telemetry(%{
          kind: :rejection_builder_exception,
          exception: exception,
          stacktrace: __STACKTRACE__
        })

        {:error, :rejection_builder_failed}
    catch
      kind, reason ->
        emit_rejection_telemetry(%{
          kind: :rejection_builder_throw,
          throw_kind: kind,
          reason: reason
        })

        {:error, :rejection_builder_failed}
    end
  end

  defp validate_rejection_data(%RejectionData{} = data) do
    cond do
      not is_map(data.resource) ->
        {:error, :invalid_rejection_resource}

      not is_atom(data.action) ->
        {:error, :invalid_rejection_action}

      not is_atom(data.rejection_code) ->
        {:error, :invalid_rejection_code}

      true ->
        {:ok, data}
    end
  end

  defp rejection_log(%RejectionData{} = data, contract, failure) do
    actor =
      case failure.input.actor do
        nil when contract.access == :internal -> :operations
        actor -> actor
      end

    source =
      case data.source do
        nil when contract.access == :internal -> :operations
        nil -> :api
        source -> source
      end

    adapter = adapter_for(contract)
    source = adapter.normalize_source(source)

    cond do
      is_nil(actor) ->
        {:error, :invalid_rejection_actor}

      not adapter.valid_source?(source) ->
        {:error, :invalid_rejection_source}

      true ->
        {:ok,
         %RejectionLog{
           actor: actor,
           resource: data.resource,
           action: data.action,
           rejection_code: data.rejection_code,
           operation_ref: failure.operation_ref,
           source: source
         }}
    end
  end

  defp write_rejection(%RejectionLog{} = log, contract) do
    try do
      adapter_for(contract).record_rejection(log)
    rescue
      exception ->
        emit_rejection_telemetry(%{
          kind: :rejection_write_exception,
          exception: exception,
          stacktrace: __STACKTRACE__
        })

        {:error, :rejection_write_failed}
    end
  end

  defp emit_rejection_telemetry(metadata) do
    :telemetry.execute([:groupher, :command_pipeline, :rejection], %{count: 1}, metadata)
  end

  defp should_run_rejection?(%Rejected{}), do: true
  defp should_run_rejection?(_reason), do: false

  defp run_direct_transaction(module, contract, operation_ref, input, stages) do
    try do
      case Repo.transaction(fn ->
             set_active(module, contract, operation_ref, :top_level)

             try do
               with {:ok, current} <- initial_value(input, stages),
                    {:ok, result} <-
                      run_stages(current, stages, operation_ref, [
                        :prepare,
                        :present,
                        :on_rejection,
                        :cleanup
                      ]) do
                 result
               else
                 {:error, {:pipeline_stage, stage, reason}} ->
                   Repo.rollback({:pipeline_stage, stage, reason})

                 {:error, reason} ->
                   Repo.rollback(reason)
               end
             after
               clear_active()
             end
           end) do
        {:ok, result} ->
          {:ok, result}

        {:error, reason} ->
          {:error, adapter_for(contract).normalize_transaction_error(reason)}
      end
    rescue
      reason in Postgrex.Error ->
        {:error, adapter_for(contract).normalize_transaction_error(reason)}

      reason in DBConnection.ConnectionError ->
        Logger.error("command pipeline transaction lost its database connection",
          reason: Exception.message(reason)
        )

        {:error, adapter_for(contract).normalize_transaction_error(reason)}
    end
  end

  defp stage_error(stage, reason), do: {:error, {:pipeline_stage, stage, reason}}

  defp validate_operation_ref(operation_ref) do
    case Ecto.UUID.cast(operation_ref) do
      {:ok, canonical} -> {:ok, canonical}
      :error -> {:error, :invalid_operation_ref}
    end
  end

  defp rejection_code(%Rejected{code: code}), do: code

  defp argument(_arguments, nil), do: nil
  defp argument(arguments, key), do: Map.fetch!(arguments, key)

  defp params(arguments, keys) when is_list(keys) do
    Map.take(arguments, keys)
  end

  defp params(arguments, key) when is_atom(key) and not is_nil(key) do
    Map.fetch!(arguments, key)
  end

  defp params(_arguments, nil), do: %{}

  defp set_active(module, contract, operation_ref, kind) do
    Process.put(@runner_key, %{
      module: module,
      contract: contract,
      operation_ref: operation_ref,
      kind: kind
    })
  end

  defp clear_active, do: Process.delete(@runner_key)

  defp adapter_for(%{adapter: adapter}) when is_atom(adapter), do: adapter
  defp adapter_for(_contract), do: GroupherServer.CommandPipeline.DefaultAdapter
end
