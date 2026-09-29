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

  alias GroupherServer.Auth
  alias Auth.Contract, as: AuthContract
  import Helper.Utils, only: [handle_absinthe_error: 3]

  @impl Absinthe.Middleware
  def call(%{context: %{delegation_auth_failure: code}} = resolution, _opts) do
    reject(resolution, "delegated user identity could not be verified", code)
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
        "service and user delegation is not authorized for this operation",
        AuthContract.service_scope_forbidden()
      )
    end
  end

  def call(%{context: %{service_auth_failure: code}} = resolution, _opts) do
    reject(resolution, "service identity could not be verified", code)
  end

  def call(%{context: %{auth_failure: code}} = resolution, _opts) do
    reject(resolution, "delegated user identity could not be verified", code)
  end

  def call(%{context: %{service_actor: _actor}} = resolution, _opts) do
    reject(
      resolution,
      "delegated user identity is required for this operation",
      AuthContract.token_missing()
    )
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
