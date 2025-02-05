# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.SeeMe do
  @behaviour Absinthe.Middleware

  def call(resolution, _) do
    resolution
  end
end
