# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.ConvertToInt do
  @moduledoc """
  Normalizes aggregate-list resolver results into a single integer value.

  SQL aggregate paths sometimes surface as `[value]` or `[]` through Absinthe.
  This middleware unwraps the one-value case and treats an empty aggregate result
  as zero.

  Business position:

      Resolver result
        -> ConvertToInt middleware
        -> next middleware
        -> GraphQL field result
  """
  @behaviour Absinthe.Middleware
  # google: must appear in the GROUP BY clause or be used in an aggregate function

  def call(%{errors: errors} = resolution, _) when errors != [], do: resolution

  def call(%{value: [value]} = resolution, _) do
    %{resolution | value: value}
  end

  def call(%{value: []} = resolution, _) do
    %{resolution | value: 0}
  end

  def call(resolution, _), do: resolution
end
