defmodule GroupherServer.CMS.CommandPipelineAdapter do
  @moduledoc """
  CMS boundary for the generic command pipeline runner.

  CMS keeps ownership of Receipt, Gate, Activity, and CMS-specific database
  error mapping. The pipeline runner itself does not depend on any of them.

      CMS Command -> generic runner -> CMS adapter -> Receipt / Gate / Activity
  """

  @behaviour GroupherServer.CommandPipeline.Adapter

  alias GroupherServer.{Activity, CMS, Repo}
  alias GroupherServer.CommandPipeline
  alias CMS.Command
  alias CMS.Command.Receipt, as: CommandReceipt
  alias CMS.Gate.Decision
  alias CommandPipeline.{Rejected, RejectionLog}

  @impl true
  def validate_contract(%{module: module, access: :open}) do
    if cms_module?(module) do
      {:error, :cms_open_access_forbidden}
    else
      {:ok, :pass}
    end
  end

  def validate_contract(_contract), do: {:ok, :pass}

  @impl true
  def validate_command_id(command_id), do: CommandReceipt.validate_command_id(command_id)

  @impl true
  def execute_receipt(_module, contract, input, command_id, callback) do
    command = %Command{
      actor: input.actor,
      command_id: command_id,
      operation: contract.operation,
      target: input.target,
      params: input.params
    }

    Command.execute(command,
      action: fn _context -> callback.() end,
      confirmation: contract.confirmation
    )
  end

  @impl true
  def normalize_gate_result({:error, %Decision{allowed: false} = decision}) do
    {:error, Rejected.new(Decision.primary_reason(decision), Decision.primary_error(decision))}
  end

  def normalize_gate_result(result), do: result

  @impl true
  def normalize_transaction_error(%Postgrex.Error{postgres: %{code: code}} = reason)
      when code in [:lock_not_available, :query_canceled] do
    normalize_pending(reason)
  end

  def normalize_transaction_error(%DBConnection.ConnectionError{} = reason) do
    normalize_pending(reason)
  end

  def normalize_transaction_error(reason), do: reason

  @impl true
  def normalize_source(source), do: Activity.const_normalize_source(source)

  @impl true
  def valid_source?(source), do: Activity.const_valid_source?(source)

  @impl true
  def record_rejection(%RejectionLog{} = log) do
    Repo.transaction(fn ->
      case Activity.log_rejection(log.resource, log.action,
             actor: log.actor,
             rejection_code: log.rejection_code,
             operation_ref: log.operation_ref,
             source: log.source
           ) do
        {:ok, value} -> value
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp normalize_pending(_reason), do: CMS.ErrorCat.command_resolution_pending()

  defp cms_module?(module) when is_atom(module) do
    String.starts_with?(inspect(module), "GroupherServer.CMS.")
  end
end
