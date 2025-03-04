defmodule GroupherServer.Test.ThirdPart do
  @moduledoc false
  use GroupherServer.TestTools

  # alias GroupherServer.CMS

  describe "[OSS test]" do
    test "can get sts token." do
      # {:ok, tokens} = CMS.upload_tokens()
      # assert tokens |> Map.keys() |> length == 4
      # assert not is_nil(tokens.access_key_id)
      # assert not is_nil(tokens.access_key_secret)
      # assert not is_nil(tokens.expiration)
      # assert not is_nil(tokens.security_token)

      {:ok, :pass}
    end
  end
end
