defmodule GroupherServer.CMS.ProductionSeed do
  @moduledoc """
  Operational facade for bounded production acceptance.

      release RPC -> ProductionSeed -> Workflow -> run ledger and domain Commands
  """
  alias __MODULE__.Workflow
  @doc "Admits an explicitly enabled operation on the actual expected database."
  defdelegate admit(database), to: Workflow
  @doc "Creates or recovers the fixed acceptance bootstrap."
  defdelegate bootstrap(run_id, database), to: Workflow
  @doc "Reports the non-secret run ownership manifest."
  defdelegate report(run_id, database), to: Workflow
  @doc "Locks and validates a run in an existing transaction."
  defdelegate lock!(run_id, active \\ true), to: Workflow
  @doc "Serializes operational changes to the shared namespace."
  defdelegate advisory_lock!(), to: Workflow
end
