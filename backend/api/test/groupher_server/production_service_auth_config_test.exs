defmodule GroupherServer.ProductionServiceAuthConfigTest do
  use ExUnit.Case, async: false

  @keys ~w(SECRET_KEY_BASE PAGINATION_CURSOR_CURRENT_KEY VIEW_TRACKER_PEPPER MENTIONS_GRAPH_KEY DATABASE_URL SERVICE_AUTH_ISSUER SERVICE_AUTH_JWKS_URL SERVICE_AUTH_TOKEN_ENDPOINT)

  setup do
    original = Map.new(@keys, &{&1, System.get_env(&1)})
    allow_test = Application.get_env(:groupher_server, :allow_test_service_auth)
    Application.put_env(:groupher_server, :allow_test_service_auth, false)

    System.put_env(%{
      "SECRET_KEY_BASE" => String.duplicate("s", 64),
      "PAGINATION_CURSOR_CURRENT_KEY" => String.duplicate("p", 64),
      "VIEW_TRACKER_PEPPER" => String.duplicate("v", 64),
      "MENTIONS_GRAPH_KEY" => String.duplicate("m", 64),
      "DATABASE_URL" => "postgres://probe:probe@deployment.example.invalid:5432/probe"
    })

    for key <- ~w(SERVICE_AUTH_ISSUER SERVICE_AUTH_JWKS_URL SERVICE_AUTH_TOKEN_ENDPOINT),
        do: System.delete_env(key)

    on_exit(fn ->
      Enum.each(original, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)

      if is_nil(allow_test) do
        Application.delete_env(:groupher_server, :allow_test_service_auth)
      else
        Application.put_env(:groupher_server, :allow_test_service_auth, allow_test)
      end
    end)

    :ok
  end

  test "production accepts deployed service endpoints and rejects inherited local targets" do
    System.put_env("SERVICE_AUTH_ISSUER", "https://auth.example.invalid")

    for environment <- [:prod, :seed_prod] do
      assert is_list(Config.Reader.read!("config/runtime.exs", env: environment))
    end

    for {key, value} <- [
          {"SERVICE_AUTH_ISSUER", "https://auth.groupher-feature.localhost"},
          {"SERVICE_AUTH_JWKS_URL", "http://127.0.0.1:3104/.well-known/jwks.json"},
          {"SERVICE_AUTH_TOKEN_ENDPOINT", "http://[::1]:3104/oauth2/token"}
        ] do
      System.put_env(key, value)

      for environment <- [:prod, :seed_prod] do
        assert_raise RuntimeError, ~r/#{key} must not target a local development service/, fn ->
          Config.Reader.read!("config/runtime.exs", env: environment)
        end
      end

      System.delete_env(key)
    end
  end
end
