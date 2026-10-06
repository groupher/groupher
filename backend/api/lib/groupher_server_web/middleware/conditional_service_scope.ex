defmodule GroupherServerWeb.Middleware.ConditionalServiceScope do
  @moduledoc """
  Keeps a public operation open to browser/anonymous requests while requiring
  exact audience and scope whenever a service or delegation is present.

      request-scoped Classification + optional service actor
        -> ConditionalServiceScope
        -> public pass | scoped service pass | GraphQL rejection
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]

  alias GroupherServer.Auth
  alias GroupherServerWeb.Middleware.ServiceScope
  alias Auth.Contract, as: AuthContract

  @impl Absinthe.Middleware
  def call(%{context: %{delegation_auth_failure: code}} = resolution, _opts) do
    reject(resolution, "delegated user identity could not be verified", code)
  end

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, "service identity could not be verified", code)
  end

  def call(%{context: %{request_actor_failure: code}} = resolution, _opts) do
    reject(
      resolution,
      "request identity could not be classified",
      normalize_failure_code(code)
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
        "service identity is not authorized for this operation",
        AuthContract.service_scope_forbidden()
      )
    end
  end

  def call(%{context: %{request_actor: _classification}} = resolution, _opts), do: resolution

  def call(resolution, _opts) do
    reject(
      resolution,
      "request identity is unavailable",
      AuthContract.service_token_invalid()
    )
  end

  defp normalize_failure_code(code) when is_binary(code) or is_integer(code), do: code
  defp normalize_failure_code(_code), do: AuthContract.service_token_invalid()

  defp reject(resolution, message, code) do
    handle_absinthe_error(resolution, message, code)
  end
end
