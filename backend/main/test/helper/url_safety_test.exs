defmodule GroupherServer.Test.Helper.UrlSafety do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Helper.UrlSafety

  describe "validate_http_url/1" do
    test "accepts regular https url" do
      assert {:ok, "https://example.com/path"} =
               UrlSafety.validate_http_url("https://example.com/path")
    end

    test "rejects localhost and private ips" do
      assert {:error, :blocked_host} = UrlSafety.validate_http_url("http://localhost:4000")
      assert {:error, :blocked_ip} = UrlSafety.validate_http_url("http://127.0.0.1/admin")

      assert {:error, :blocked_ip} =
               UrlSafety.validate_http_url("http://169.254.169.254/latest/meta-data")
    end

    test "rejects non-http scheme" do
      assert {:error, :invalid_scheme} = UrlSafety.validate_http_url("file:///etc/passwd")
    end
  end
end
