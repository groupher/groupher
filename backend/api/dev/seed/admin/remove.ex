defmodule GroupherServer.Seed.Admin.Remove do
  @moduledoc """
  Removes a run-owned administrator through the shared revisioned operation.

      actor + member -> membership operation -> CMS Context
  """

  @doc "Runs one administrator removal."
  def run(run, input), do: GroupherServer.Seed.Admin.Membership.run(:remove, run, input)
end
