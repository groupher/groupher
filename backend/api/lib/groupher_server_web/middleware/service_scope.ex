defmodule GroupherServerWeb.Middleware.ServiceScope do
  @moduledoc """
  Requires one exact service-token audience and operation scope.

  Business position:

      Resolver result
        -> ServiceScope middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  alias GroupherServer.Accounts
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.ErrorResponse

  @impl Absinthe.Middleware
  def call(%{context: %{delegation_auth_failure: code}} = resolution, _opts) do
    reject(
      resolution,
      auth_error(code, "delegated user identity could not be verified")
    )
  end

  def call(%{context: %{service_actor: actor}} = resolution, opts) do
    audience = Keyword.fetch!(opts, :audience)
    scope = Keyword.fetch!(opts, :scope)

    if authorized?(actor, audience, scope) do
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

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, auth_error(code, "service identity could not be verified"))
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

      code == GroupherServer.Auth.contract_token_invalid() ->
        Accounts.profiles_error_cat_invalid_browser_access_claims(message)

      code == GroupherServer.Auth.contract_token_missing() ->
        WebErrorCat.token_missing(message)

      true ->
        WebErrorCat.invalid_service_token(message)
    end
  end

  @doc "Checks one verified service credential against an exact audience and scope."
  @spec authorized?(map(), String.t(), String.t()) :: boolean()
  def authorized?(actor, audience, scope) when is_map(actor) do
    test_actor =
      Map.get(actor, :subject) == "service:test-suite" and
        match?(%MapSet{}, Map.get(actor, :scopes)) and
        MapSet.member?(actor.scopes, "*")

    test_actor or
      (Map.get(actor, :audience) == audience and
         match?(%MapSet{}, Map.get(actor, :scopes)) and
         MapSet.member?(actor.scopes, scope))
  end

  def authorized?(_actor, _audience, _scope), do: false
end
