defmodule GroupherServerWeb.Middleware.ServiceIdentityMiddlewareTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Auth
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.Middleware.{BodyBagTrust, DelegatedScope, GeneralError, GQLResultFmt}

  test "DelegatedScope distinguishes verifier, user-proof, and scope failures" do
    verifier_failure =
      DelegatedScope.call(
        %Absinthe.Resolution{
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        audience: "phoenix:auth-api",
        scope: "auth:oauth:read"
      )

    assert error_code(verifier_failure) == WebErrorCat.jwks_unavailable().code

    missing_user =
      DelegatedScope.call(
        %Absinthe.Resolution{context: %{service_actor: actor("auth:oauth:read")}},
        audience: "phoenix:auth-api",
        scope: "auth:oauth:read"
      )

    assert error_code(missing_user) == WebErrorCat.token_missing().code

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

    assert error_code(under_scoped) == WebErrorCat.service_scope_forbidden().code
  end

  test "BodyBagTrust distinguishes verifier and publisher-scope failures" do
    verifier_failure =
      BodyBagTrust.call(
        %Absinthe.Resolution{
          arguments: %{body_bag: %{}},
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        scope: "content:comment:write"
      )

    assert error_code(verifier_failure) == WebErrorCat.jwks_unavailable().code

    under_scoped =
      BodyBagTrust.call(
        %Absinthe.Resolution{
          arguments: %{body_bag: %{}},
          context: %{service_actor: actor("content:article:write")}
        },
        scope: "content:comment:write"
      )

    assert error_code(under_scoped) == WebErrorCat.service_scope_forbidden().code
  end

  defp actor(scope) do
    %{
      audience: "phoenix:content-publisher-api",
      scopes: MapSet.new([scope]),
      subject: "service:test"
    }
  end

  defp error_code(%Absinthe.Resolution{} = resolution) do
    %{errors: [%{message: _message, extensions: %{code: code}}]} =
      resolution
      |> GQLResultFmt.call([])
      |> GeneralError.call([])

    code
  end
end
