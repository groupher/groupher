# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---

defmodule GroupherServerWeb.Middleware.ViewerDidConvert do
  @moduledoc """
  Converts viewer-state lookup results into GraphQL booleans.

  Several viewer state resolvers return a list from an existence query. This
  middleware turns nil/empty results into `false` and a single matched row into
  `true` for public schema fields.
  """
  @behaviour Absinthe.Middleware

  def call(%{value: nil} = resolution, _) do
    %{resolution | value: false}
  end

  def call(%{value: []} = resolution, _) do
    %{resolution | value: false}
  end

  def call(%{value: [_]} = resolution, _) do
    %{resolution | value: true}
  end
end
