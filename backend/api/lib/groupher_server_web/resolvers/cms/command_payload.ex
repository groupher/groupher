defmodule GroupherServerWeb.Resolvers.CMS.CommandPayload do
  @moduledoc """
  Projects stable command result metadata onto GraphQL payload fields.

      domain command result -> this resolver -> GraphQL command payload
  """

  @doc "Returns the command ID carried by the parent result, or nil if absent."
  def command_id(value, _args, _info) do
    {:ok, Map.get(value, :command_id)}
  end
end
