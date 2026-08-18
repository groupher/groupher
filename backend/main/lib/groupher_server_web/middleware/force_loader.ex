defmodule GroupherServerWeb.Middleware.ForceLoader do
  @moduledoc """
  Injects the parent source id into loader arguments for related-user fields.

  This preserves a legacy per-parent loading contract by adding `what_ever` to
  the field arguments. It can produce N+1 queries and should be removed when
  those fields use a grouped top-N loader.

  Business position:

      Resolver result
        -> ForceLoader middleware
        -> next middleware
        -> GraphQL field result
  """
  @behaviour Absinthe.Middleware

  @doc "Adds the current source id to loader arguments and preserves resolution state."
  def call(%{source: %{id: id}} = resolution, _) do
    arguments = resolution.arguments |> Map.merge(%{what_ever: id})

    %{resolution | arguments: arguments}
    # resolution
  end

  def call(%{errors: errors} = resolution, _) when length(errors) > 0, do: resolution

  def call(resolution, _) do
    resolution
  end
end
