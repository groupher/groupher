defmodule GroupherServer.CommandPipeline.Adapter do
  @moduledoc """
  Context-specific services used by the generic command pipeline runner.

  The runner owns ordering, transaction boundaries, and rejection semantics.
  An adapter supplies only the boundary that belongs to a context: receipt
  execution, contract validation, Gate result normalization, infrastructure
  error mapping, and rejection recording.

      Command -> generic runner -> context adapter -> context-owned boundary
  """

  alias GroupherServer.CommandPipeline
  alias CommandPipeline.{RejectionLog, Rejected}

  @callback validate_contract(map()) :: {:ok, :pass} | {:error, term()}
  @callback validate_command_id(term()) :: {:ok, term()} | {:error, term()}
  @callback execute_receipt(module(), map(), map(), term(), (Ecto.UUID.t() -> term())) :: term()
  @callback normalize_gate_result(term()) :: term()
  @callback normalize_transaction_error(term()) :: term()
  @callback normalize_source(term()) :: term()
  @callback valid_source?(term()) :: boolean()
  @callback record_rejection(RejectionLog.t()) :: {:ok, term()} | {:error, term()}

  @doc false
  @spec rejection?(term()) :: boolean()
  def rejection?(%Rejected{}), do: true
  def rejection?(_), do: false
end
