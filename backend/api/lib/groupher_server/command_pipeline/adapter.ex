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

  @doc "Validates that the adapter supports the compiled pipeline contract."
  @callback validate_contract(map()) :: {:ok, :pass} | {:error, term()}

  @doc "Validates and normalizes the command identity required for Receipt execution."
  @callback validate_command_id(term()) :: {:ok, term()} | {:error, term()}

  @doc "Runs the pipeline callback inside the context's retry-safe Receipt boundary."
  @callback execute_receipt(module(), map(), map(), term(), (Ecto.UUID.t() -> term())) :: term()

  @doc "Converts a context-specific Gate denial into the runner's rejection marker when needed."
  @callback normalize_gate_result(term()) :: term()

  @doc "Maps transaction infrastructure failures into errors suitable for command callers."
  @callback normalize_transaction_error(term()) :: term()

  @doc "Normalizes a caller-provided Activity source for the context."
  @callback normalize_source(term()) :: term()

  @doc "Reports whether a normalized Activity source is accepted by the context."
  @callback valid_source?(term()) :: boolean()

  @doc "Persists the rejection audit record independently from the failed command transaction."
  @callback record_rejection(RejectionLog.t()) :: {:ok, term()} | {:error, term()}

  @doc false
  @spec rejection?(term()) :: boolean()
  def rejection?(%Rejected{}), do: true
  def rejection?(_), do: false
end
