defmodule GroupherServer.Test.Accounts.FrontDesk do
  @moduledoc false
  use GroupherServer.TestTools

  alias Helper.Cache

  @cache_pool :user_login

  describe "[get userid]" do
    test "userid should work" do
      {:ok, user} = db_insert(:user)

      {:ok, user_id} = Accounts.FrontDesk.userid(user.login)
      assert user.id == user_id

      assert {:ok, user_id} = Cache.get(@cache_pool, user.login)
      assert user_id == user.id
    end
  end
end
