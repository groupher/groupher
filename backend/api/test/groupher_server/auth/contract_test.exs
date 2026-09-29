defmodule GroupherServer.Auth.ContractTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Auth
  alias Auth.Contract

  test "keeps auth error codes stable" do
    assert Contract.invalid_request() == "INVALID_REQUEST"
    assert Contract.invalid_csrf() == "INVALID_CSRF"
    assert Contract.token_expired() == "TOKEN_EXPIRED"
    assert Contract.oauth_last_login_method() == "OAUTH_LAST_LOGIN_METHOD"
  end

  test "keeps Phoenix browser token claims stable" do
    assert Contract.phoenix_browser_token_claims() == %{
             audience: "phoenix:browser-api",
             issuer: "groupher:phoenix",
             type: "browser_access"
           }
  end
end
