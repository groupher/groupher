defmodule Helper.Guardian.BrowserEnvironmentIsolationTest do
  use ExUnit.Case, async: false

  alias Helper.Guardian.BrowserAccess

  test "browser credentials signed by different environment secrets cannot cross" do
    original = Application.fetch_env!(:groupher_server, BrowserAccess)
    on_exit(fn -> Application.put_env(:groupher_server, BrowserAccess, original) end)

    secret_a = Base.url_encode64(:crypto.strong_rand_bytes(48))
    secret_b = Base.url_encode64(:crypto.strong_rand_bytes(48))
    expires_at = DateTime.add(DateTime.utc_now(), 3600, :second)

    Application.put_env(
      :groupher_server,
      BrowserAccess,
      Keyword.put(original, :secret_key, secret_a)
    )

    assert {:ok, token_a, _claims} = BrowserAccess.encode(%{id: 42}, "session-a", expires_at)
    assert {:ok, _claims} = BrowserAccess.decode_claims(token_a)

    Application.put_env(
      :groupher_server,
      BrowserAccess,
      Keyword.put(original, :secret_key, secret_b)
    )

    assert {:ok, token_b, _claims} = BrowserAccess.encode(%{id: 42}, "session-b", expires_at)
    assert {:ok, _claims} = BrowserAccess.decode_claims(token_b)
    assert {:error, _reason} = BrowserAccess.decode_claims(token_a)

    Application.put_env(
      :groupher_server,
      BrowserAccess,
      Keyword.put(original, :secret_key, secret_a)
    )

    assert {:error, _reason} = BrowserAccess.decode_claims(token_b)
  end
end
