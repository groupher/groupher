defmodule GroupherServerWeb.Middleware.DelegatedScope do
  @moduledoc """
  Requires a scoped service actor explicitly bound to a current user actor.

  Business position:

      Resolver result
        -> DelegatedScope middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  alias GroupherServer.Accounts
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.ErrorResponse

  @impl Absinthe.Middleware
  def call(%{context: %{delegation_auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "delegated user identity could not be verified"))
  end

  def call(%{context: %{delegated_actor: delegated}} = resolution, opts) do
    actor = delegated.service_actor

    test_actor = actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")

    if test_actor or
         (actor.audience == Keyword.fetch!(opts, :audience) and
            MapSet.member?(actor.scopes, Keyword.fetch!(opts, :scope))) do
      resolution
    else
      reject(
        resolution,
        WebErrorCat.service_scope_forbidden(
          "service and user delegation is not authorized for this operation"
        )
      )
    end
  end

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "service identity could not be verified"))
  end

  def call(%{context: %{auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "delegated user identity could not be verified"))
  end

  def call(%{context: %{service_actor: _actor}} = resolution, _opts) do
    reject(
      resolution,
      WebErrorCat.token_missing("delegated user identity is required for this operation")
    )
  end

  def call(resolution, _opts) do
    reject(
      resolution,
      WebErrorCat.invalid_service_token("service identity is required for this operation")
    )
  end

  defp reject(resolution, error) do
    ErrorResponse.put_error(resolution, error)
  end

  defp auth_error(code, message) do
    cond do
      code == GroupherServer.Auth.contract_service_jwks_unavailable() ->
        WebErrorCat.jwks_unavailable(message)

      code == GroupherServer.Auth.contract_session_revoked() ->
        Accounts.profiles_error_cat_session_revoked(message)

      code == GroupherServer.Auth.contract_token_expired() ->
        Accounts.profiles_error_cat_session_expired(message)

      code == GroupherServer.Auth.contract_token_missing() ->
        WebErrorCat.token_missing(message)

      code == GroupherServer.Auth.contract_token_invalid() ->
        Accounts.profiles_error_cat_invalid_browser_access_claims(message)

      true ->
        WebErrorCat.service_auth(message)
    end
  end
end
