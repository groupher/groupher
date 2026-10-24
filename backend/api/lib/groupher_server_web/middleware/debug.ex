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

  alias GroupherServer.Accounts
  alias GroupherServerWeb.ErrorResponse

  def call(%{context: %{cur_user: _}} = resolution, _info), do: resolution

  def call(resolution, _) do
    ErrorResponse.put_error(resolution, Accounts.profiles_error_cat_account_login())
  end
end
