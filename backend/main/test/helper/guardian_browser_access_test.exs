defmodule Helper.Guardian.BrowserAccessTest do
  use ExUnit.Case, async: true

  alias Helper.Guardian
  alias Helper.Guardian.BrowserAccess

  @session_ref "bs_internal_session_ref"

  test "browser and legacy credentials keep independent issuer contracts" do
    user = %{id: 42}
    session_expires_at = DateTime.add(DateTime.utc_now(), 3600, :second)

    assert {:ok, browser_token, browser_claims} =
             BrowserAccess.encode(user, @session_ref, session_expires_at)

    assert browser_claims["iss"] == "groupher:phoenix"
    assert browser_claims["aud"] == "phoenix:browser-api"
    assert browser_claims["typ"] == "browser_access"
    assert browser_claims["sub"] == "42"
    assert browser_claims["sid"] == @session_ref
    assert BrowserAccess.valid_claims?(browser_claims)

    assert {:ok, legacy_token, legacy_claims} = Guardian.jwt_encode(user)
    assert legacy_claims["iss"] == "groupher_server"
    assert legacy_claims["aud"] == "groupher_server"
    assert legacy_claims["typ"] == "access"
    assert {:ok, %{id: "42"}, ^legacy_claims} = Guardian.jwt_decode(legacy_token)
    refute BrowserAccess.valid_claims?(legacy_claims)

    assert {:error, _reason} = BrowserAccess.decode_claims(legacy_token)
    assert {:error, _reason} = Guardian.jwt_decode(browser_token)
  end

  test "browser access token cannot outlive the persisted Session" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    session_expires_at = DateTime.add(now, 60, :second)

    assert {:ok, _token, claims} =
             BrowserAccess.encode(%{id: 42}, @session_ref, session_expires_at, now)

    assert claims["exp"] - claims["iat"] == 60
    assert BrowserAccess.expires_at(session_expires_at, now) == session_expires_at
  end

  test "expired persisted Session cannot issue a browser access token" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :session_expired}} =
             BrowserAccess.encode(%{id: 42}, @session_ref, now, now)
  end
end
