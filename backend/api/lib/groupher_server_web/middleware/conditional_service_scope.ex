defmodule GroupherServerWeb.Middleware.ConditionalServiceScope do
  @moduledoc """
  Keeps a public operation open to browser/anonymous requests while requiring
  exact audience and scope whenever a service or delegation is present.

      request-scoped Classification + optional service actor
        -> ConditionalServiceScope
        -> public pass | scoped service pass | GraphQL rejection
  """

  @behaviour Absinthe.Middleware

  alias GroupherServer.Accounts
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.ErrorResponse
  alias GroupherServerWeb.Middleware.ServiceScope

  @impl Absinthe.Middleware
  def call(%{context: %{delegation_auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "delegated user identity could not be verified"))
  end

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "service identity could not be verified"))
  end

  def call(%{context: %{request_actor_failure: _code}} = resolution, _opts) do
    reject(
      resolution,
      WebErrorCat.request_identity_unavailable("request identity could not be classified")
    )
  end

  def call(%{context: %{service_actor: actor}} = resolution, opts) do
    audience = Keyword.fetch!(opts, :audience)
    scope = Keyword.fetch!(opts, :scope)

    if ServiceScope.authorized?(actor, audience, scope) do
      resolution
    else
      reject(
        resolution,
        WebErrorCat.service_scope_forbidden(
          "service identity is not authorized for this operation"
        )
      )
    end
  end

  def call(%{context: %{request_actor: _classification}} = resolution, _opts), do: resolution

  def call(resolution, _opts) do
    reject(resolution, WebErrorCat.invalid_service_token("request identity is unavailable"))
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
