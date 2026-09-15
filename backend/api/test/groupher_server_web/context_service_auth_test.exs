defmodule GroupherServerWeb.ContextServiceAuthTest do
  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias GroupherServer.Auth
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.Context
  alias GroupherServerWeb.ServiceAuth.Verifier

  setup do
    key = JOSE.JWK.generate_key({:rsa, 2048})
    {_, public_jwk} = key |> JOSE.JWK.to_public() |> JOSE.JWK.to_map()
    public_jwk = Map.put(public_jwk, "kid", "context-service-test-key")
    previous = Application.get_env(:groupher_server, Verifier)

    Application.put_env(:groupher_server, Verifier,
      issuer: "https://auth.groupher.test",
      audiences: ["phoenix:auth-api"],
      jwks: %{"keys" => [public_jwk]}
    )

    on_exit(fn -> Application.put_env(:groupher_server, Verifier, previous || []) end)
    {:ok, key: key}
  end

  test "keeps service verification failure separate from browser auth failure", %{key: key} do
    context =
      :post
      |> conn("/graphiql")
      |> put_req_header("authorization", "Bearer #{token(key, "https://wrong-issuer.test")}")
      |> Context.build_context()

    assert context.service_auth_failure == AuthContract.service_token_invalid()
    refute Map.has_key?(context, :service_actor)
    refute Map.has_key?(context, :auth_failure)
  end

  defp token(key, issuer) do
    now = DateTime.utc_now() |> DateTime.to_unix()

    signed =
      JOSE.JWT.sign(
        key,
        %{"alg" => "RS256", "kid" => "context-service-test-key", "typ" => "service_access+jwt"},
        %{
          "aud" => "phoenix:auth-api",
          "exp" => now + 600,
          "iat" => now,
          "iss" => issuer,
          "jti" => "context-service-token",
          "nbf" => now,
          "scope" => "auth:session:refresh",
          "sub" => "service:auth"
        }
      )

    {_, compact} = JOSE.JWS.compact(signed)
    compact
  end
end
