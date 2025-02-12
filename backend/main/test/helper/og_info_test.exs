defmodule GroupherServer.Test.Helper.OgInfo do
  @moduledoc false
  use GroupherServerWeb.ConnCase, async: true

  alias Helper.OgInfo

  describe "[oginfo test]" do
    test "can get valid open graph info with valid url.." do
      # Good example
      {:ok, ret} = OgInfo.get("https://www.ifanr.com/1561465")

      assert not is_nil(ret.title)
      assert not is_nil(ret.favicon)
      assert not is_nil(ret.site_name)
    end

    test "shoud fmt site_info for sspai.com" do
      {:ok, ret} = OgInfo.get("https://sspai.com/post/82704")

      assert not is_nil(ret.title)
      assert not is_nil(ret.favicon)
      assert ret.site_name == "少数派"
    end

    test "shoud add site_info for 36kr.com cuz it missing it" do
      {:ok, ret} = OgInfo.get("https://36kr.com/p/2421145363096585")

      assert not is_nil(ret.title)
      assert not is_nil(ret.favicon)
      assert not is_nil(ret.url)
      assert ret.site_name == "36kr"
    end

    test "can get valid open graph info with invalid url.." do
      {:error, error} = OgInfo.get("https://thisnotexisteekde.com")
      # IO.inspect(error, label: "get")
    end
  end
end
