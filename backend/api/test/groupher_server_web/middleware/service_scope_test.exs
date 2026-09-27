defmodule GroupherServerWeb.Middleware.ServiceScopeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Auth
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.Middleware.ServiceScope

  @opts [audience: "phoenix:auth-api", scope: "auth:session:refresh"]

  test "allows an actor with the exact audience and scope" do
    resolution =
      %Absinthe.Resolution{
        context: %{
          service_actor: %{
            audience: "phoenix:auth-api",
            scopes: MapSet.new(["auth:session:refresh"]),
            subject: "service:auth"
          }
        }
      }

    assert ServiceScope.call(resolution, @opts) == resolution
  end

  test "returns a stable forbidden code for a verified but under-scoped actor" do
    result =
      ServiceScope.call(
        %Absinthe.Resolution{
          context: %{
            service_actor: %{
              audience: "phoenix:auth-api",
              scopes: MapSet.new(["auth:session:read"]),
              subject: "service:auth"
            }
          }
        },
        @opts
      )

    assert [[message: _message, extensions: %{code: code}]] = result.errors
    assert code == AuthContract.service_scope_forbidden()
  end

  test "preserves a verifier failure instead of collapsing it into scope denial" do
    result =
      ServiceScope.call(
        %Absinthe.Resolution{
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        @opts
      )

    assert [[message: _message, extensions: %{code: code}]] = result.errors
    assert code == AuthContract.service_jwks_unavailable()
  end

  test "rejects delegation verification failure before an otherwise authorized service" do
    result =
      ServiceScope.call(
        %Absinthe.Resolution{
          context: %{
            delegation_auth_failure: AuthContract.token_invalid(),
            service_actor: %{
              audience: "phoenix:auth-api",
              scopes: MapSet.new(["auth:session:refresh"]),
              subject: "service:auth"
            }
          }
        },
        @opts
      )

    assert [[message: _message, extensions: %{code: code}]] = result.errors
    assert code == AuthContract.token_invalid()
  end

  test "returns an authentication code when no service identity is present" do
    result = ServiceScope.call(%Absinthe.Resolution{context: %{}}, @opts)

    assert [[message: _message, extensions: %{code: code}]] = result.errors
    assert code == AuthContract.service_token_invalid()
  end
end
