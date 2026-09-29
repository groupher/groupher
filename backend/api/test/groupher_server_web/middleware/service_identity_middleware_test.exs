defmodule GroupherServerWeb.Middleware.ServiceIdentityMiddlewareTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Auth
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.Middleware.{BodyBagTrust, DelegatedScope}

  test "DelegatedScope distinguishes verifier, user-proof, and scope failures" do
    verifier_failure =
      DelegatedScope.call(
        %Absinthe.Resolution{
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        audience: "phoenix:auth-api",
        scope: "auth:oauth:read"
      )

    assert error_code(verifier_failure) == AuthContract.service_jwks_unavailable()

    missing_user =
      DelegatedScope.call(
        %Absinthe.Resolution{context: %{service_actor: actor("auth:oauth:read")}},
        audience: "phoenix:auth-api",
        scope: "auth:oauth:read"
      )

    assert error_code(missing_user) == AuthContract.token_missing()

    under_scoped =
      DelegatedScope.call(
        %Absinthe.Resolution{
          context: %{
            delegated_actor: %{service_actor: actor("auth:session:read"), user_actor: %{id: 1}}
          }
        },
        audience: "phoenix:auth-api",
        scope: "auth:oauth:read"
      )

    assert error_code(under_scoped) == AuthContract.service_scope_forbidden()
  end

  test "BodyBagTrust distinguishes verifier and publisher-scope failures" do
    verifier_failure =
      BodyBagTrust.call(
        %Absinthe.Resolution{
          arguments: %{body_bag: %{}},
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        []
      )

    assert error_code(verifier_failure) == AuthContract.service_jwks_unavailable()

    under_scoped =
      BodyBagTrust.call(
        %Absinthe.Resolution{
          arguments: %{body_bag: %{}},
          context: %{service_actor: actor("content-import:read")}
        },
        []
      )

    assert error_code(under_scoped) == AuthContract.service_scope_forbidden()
  end

  defp actor(scope) do
    %{
      audience:
        if(String.starts_with?(scope, "content-import:"),
          do: "phoenix:content-import-api",
          else: "phoenix:auth-api"
        ),
      scopes: MapSet.new([scope]),
      subject: "service:test"
    }
  end

  defp error_code(%Absinthe.Resolution{errors: [[message: _message, extensions: %{code: code}]]}),
    do: code
end
