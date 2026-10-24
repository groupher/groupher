defmodule GroupherServerWeb.Middleware.DelegatedScopeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Auth
  alias GroupherServerWeb.Middleware.{DelegatedScope, GeneralError, GQLResultFmt}
  alias Auth.Contract, as: AuthContract

  @opts [audience: "phoenix:auth-api", scope: "auth:oauth:read"]

  test "rejects delegation verification failure before an otherwise authorized delegation" do
    service_actor = %{
      audience: "phoenix:auth-api",
      scopes: MapSet.new(["auth:oauth:read"]),
      subject: "service:auth"
    }

    result =
      DelegatedScope.call(
        %Absinthe.Resolution{
          context: %{
            delegation_auth_failure: AuthContract.token_invalid(),
            delegated_actor: %{service_actor: service_actor, user_actor: %{id: 1}}
          }
        },
        @opts
      )
      |> finalize_error()

    assert [%{message: _message, extensions: %{code: code}}] = result.errors
    assert code == AuthContract.token_invalid()
  end

  defp finalize_error(resolution) do
    resolution
    |> GQLResultFmt.call([])
    |> GeneralError.call([])
  end
end
