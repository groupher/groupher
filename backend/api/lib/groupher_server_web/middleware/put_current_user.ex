# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.PutCurrentUser do
  @moduledoc """
  Copies the authenticated viewer from Absinthe context into field arguments.

      context.cur_user
          |
          v
      resolution.arguments.cur_user

  Use this middleware when downstream resolver code expects the viewer in the
  argument map instead of reading from the Absinthe context directly.

  Business position:

      Resolver result
        -> PutCurrentUser middleware
        -> next middleware
        -> GraphQL field result
  """
  @behaviour Absinthe.Middleware

  def call(%{context: %{cur_user: cur_user}} = resolution, _) do
    arguments = resolution.arguments |> Map.merge(%{cur_user: cur_user})

    %{resolution | arguments: arguments}
  end

  def call(%{errors: errors} = resolution, _) when errors != [], do: resolution

  def call(resolution, _) do
    resolution
  end
end
