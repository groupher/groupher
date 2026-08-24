# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.CountLength do
  @moduledoc """
  Converts list-valued resolver results into their count for GraphQL metrics.

  Use this only at schema fields whose public contract is an integer count, not
  at fields that should expose the list itself.

  Business position:

      Resolver result
        -> CountLength middleware
        -> next middleware
        -> GraphQL field result
  """
  @behaviour Absinthe.Middleware
  # google: must appear in the GROUP BY clause or be used in an aggregate function

  def call(%{errors: errors} = resolution, _) when errors != [], do: resolution

  def call(%{value: []} = resolution, _) do
    %{resolution | value: 0}
  end

  def call(%{value: value} = resolution, _) when is_list(value) do
    %{resolution | value: length(value)}
  end

  def call(resolution, _), do: resolution
end
