defmodule GroupherServerWeb.ServiceAuthVerifierTest do
  use ExUnit.Case, async: false

  alias GroupherServerWeb.ServiceAuth.Verifier

  setup do
    key = JOSE.JWK.generate_key({:rsa, 2048})
    {_, public_jwk} = key |> JOSE.JWK.to_public() |> JOSE.JWK.to_map()
    public_jwk = Map.put(public_jwk, "kid", "service-test-key")
    previous = Application.get_env(:groupher_server, Verifier)

    Application.put_env(:groupher_server, Verifier,
      issuer: "https://auth.groupher.test",
      audiences: ["phoenix:press-api"],
      jwks: %{"keys" => [public_jwk]}
    )

    on_exit(fn -> Application.put_env(:groupher_server, Verifier, previous || []) end)
    {:ok, key: key}
  end

  test "verifies a typed, audience-bound service token", %{key: key} do
    assert {:ok, actor} = key |> token() |> Verifier.verify()
    assert actor.subject == "service:press"
    assert actor.audience == "phoenix:press-api"
    assert MapSet.member?(actor.scopes, "press:article:read")
  end

  test "rejects the same signature for another audience", %{key: key} do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_service_token}} =
             key
             |> token(%{"aud" => "press:internal-api"})
             |> Verifier.verify()
  end

  test "recognizes only the dedicated service token type", %{key: key} do
    assert Verifier.service_token?(token(key))
    refute Verifier.service_token?(token(key, %{}, "JWT"))
  end

  defp token(key, overrides \\ %{}, type \\ "service_access+jwt") do
    now = DateTime.utc_now() |> DateTime.to_unix()

    claims =
      Map.merge(
        %{
          "aud" => "phoenix:press-api",
          "exp" => now + 600,
          "iat" => now,
          "iss" => "https://auth.groupher.test",
          "jti" => "token-test-id",
          "nbf" => now,
          "scope" => "press:article:read",
          "sub" => "service:press"
        },
        overrides
      )

    signed =
      JOSE.JWT.sign(
        key,
        %{"alg" => "RS256", "kid" => "service-test-key", "typ" => type},
        claims
      )

    {_, compact} = JOSE.JWS.compact(signed)
    compact
  end
end
