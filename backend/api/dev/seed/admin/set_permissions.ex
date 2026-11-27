defmodule GroupherServer.Seed.Admin.SetPermissions do
  @moduledoc """
  Updates a run-owned administrator through the shared revisioned operation.

      actor + member + permissions -> membership operation -> CMS Context
  """

  @doc "Runs one administrator permission update."
  def run(run, input), do: GroupherServer.Seed.Admin.Membership.run(:set_permissions, run, input)
end
