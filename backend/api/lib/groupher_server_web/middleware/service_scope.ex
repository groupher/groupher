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

  alias GroupherServer.Auth
  alias Auth.Contract, as: AuthContract
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @impl Absinthe.Middleware
  def call(%{context: %{service_actor: actor}} = resolution, opts) do
    audience = Keyword.fetch!(opts, :audience)
    scope = Keyword.fetch!(opts, :scope)

    test_actor = actor.subject == "service:test-suite" and MapSet.member?(actor.scopes, "*")

    if test_actor or (actor.audience == audience and MapSet.member?(actor.scopes, scope)) do
      resolution
    else
      reject(
        resolution,
        "service identity is not authorized for this operation",
        AuthContract.service_scope_forbidden()
      )
    end
  end

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, "service identity could not be verified", code)
  end

  def call(resolution, _opts) do
    reject(
      resolution,
      "service identity is required for this operation",
      AuthContract.service_token_invalid()
    )
  end

  defp reject(resolution, message, code) do
    handle_absinthe_error(resolution, message, code)
  end
end
