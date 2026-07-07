# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.SeeMe do
  @moduledoc """
  No-op middleware reserved for resolver inspection during GraphQL debugging.

  Keeping this as an explicit middleware makes it possible to attach temporary
  breakpoints or logging in one place without changing schema definitions.
  """
  @behaviour Absinthe.Middleware

  def call(resolution, _) do
    resolution
  end
end
