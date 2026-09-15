defmodule GroupherServerWeb.ServiceAuthVerifierTest do
  use ExUnit.Case, async: false

  alias GroupherServer.ErrorCat

  alias GroupherServerWeb.ServiceAuth.Verifier

  setup do
    if :ets.whereis(:groupher_service_auth_jwks) != :undefined do
      :ets.delete_all_objects(:groupher_service_auth_jwks)
    end

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
    assert {:error, %ErrorCat.Error{reason: :invalid_claims}} =
             key
             |> token(%{"aud" => "press:internal-api"})
             |> Verifier.verify()
  end

  test "rejects invalid service claims", %{key: key} do
    for overrides <- [
          %{"sub" => "user:press"},
          %{"scope" => nil},
          %{"iat" => (DateTime.utc_now() |> DateTime.to_unix()) + 601},
          %{"nbf" => (DateTime.utc_now() |> DateTime.to_unix()) + 601},
          %{"exp" => (DateTime.utc_now() |> DateTime.to_unix()) - 601}
        ] do
      assert {:error, %ErrorCat.Error{reason: :invalid_claims}} =
               key |> token(overrides) |> Verifier.verify()
    end
  end

  test "preserves malformed, unknown-key, and signature failures", %{key: key} do
    assert {:error, %ErrorCat.Error{reason: :malformed_token}} =
             Verifier.verify("not-a-jwt")

    assert {:error, %ErrorCat.Error{reason: :unknown_kid}} =
             key |> token(%{}, "service_access+jwt", "unknown-key") |> Verifier.verify()

    other_key = JOSE.JWK.generate_key({:rsa, 2048})

    assert {:error, %ErrorCat.Error{reason: :invalid_service_token}} =
             other_key |> token() |> Verifier.verify()
  end

  test "preserves retryable JWKS failures", %{key: key} do
    Application.put_env(:groupher_server, Verifier,
      issuer: "https://auth.groupher.test",
      audiences: ["phoenix:press-api"],
      jwks_url: "http://127.0.0.1:1/.well-known/jwks.json"
    )

    assert {:error, %ErrorCat.Error{reason: :jwks_unavailable}} =
             key |> token() |> Verifier.verify()
  end

  test "recognizes only the dedicated service token type", %{key: key} do
    assert Verifier.service_token?(token(key))
    refute Verifier.service_token?(token(key, %{}, "JWT"))
  end

  defp token(
         key,
         overrides \\ %{},
         type \\ "service_access+jwt",
         kid \\ "service-test-key"
       ) do
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
        %{"alg" => "RS256", "kid" => kid, "typ" => type},
        claims
      )

    {_, compact} = JOSE.JWS.compact(signed)
    compact
  end
end
