# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.PutRootSource do
  @moduledoc """
  Copies a parent resolver source id into child-field arguments.

  This middleware is used by nested GraphQL fields that need the parent object's
  id while still calling a resolver that reads from `resolution.arguments`.
  Preserve the current argument name unless the consuming resolver contract is
  migrated at the same time.

  Business position:

      Resolver result
        -> PutRootSource middleware
        -> next middleware
        -> GraphQL field result
  """
  @behaviour Absinthe.Middleware

  # def call(%{source: %{id: id}} = resolution, _) do
  # arguments = resolution.arguments |> Map.merge(%{root_source_id: id})

  # %{resolution | arguments: arguments}
  # end

  def call(%{source: %{id: id}} = resolution, _) do
    arguments = resolution.arguments |> Map.merge(%{jj: id})

    %{resolution | arguments: arguments}
    # resolution
  end

  def call(%{errors: errors} = resolution, _) when errors != [], do: resolution

  def call(resolution, _), do: resolution
end
