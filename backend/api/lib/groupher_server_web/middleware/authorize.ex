# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.Authorize do
  @moduledoc """
  Rejects GraphQL fields that require a current authenticated user.

  It also projects credential-verification failures from the context into the
  shared GraphQL error contract.

  Business position:

      Absinthe context
        -> Authorize
        -> authenticated resolver or auth error
        -> GraphQL response
  """

  @behaviour Absinthe.Middleware

  alias GroupherServer.Accounts
  alias GroupherServerWeb.ErrorResponse

  def call(%{context: %{cur_user: _}} = resolution, _info), do: resolution

  def call(%{context: %{auth_failure: code}} = resolution, _info) do
    error =
      if code == GroupherServer.Auth.contract_token_expired() do
        Accounts.profiles_error_cat_session_expired("Authorize: browser token is expired")
      else
        Accounts.profiles_error_cat_invalid_browser_access_claims(
          "Authorize: browser token is invalid"
        )
      end

    ErrorResponse.put_error(resolution, error)
  end

  def call(resolution, _) do
    ErrorResponse.put_error(resolution, Accounts.profiles_error_cat_account_login())
  end
end
