# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.Debug do
  @moduledoc """
  Legacy login-check middleware retained for schema compatibility.

  New authorization decisions belong to `Authorize` and domain permission
  gates; this module only rejects a missing current user.

  Business position:

      Resolver result
        -> Debug middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]
  import Helper.ErrorCode

  def call(%{context: %{cur_user: _}} = resolution, _info), do: resolution

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("Authorize: need login", ecode(:account_login))
  end
end
