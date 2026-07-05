defmodule GroupherServer.Test.Accounts.FrontDesk do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.FrontDesk
  alias Helper.Cache

  @login_cache_pool :user_login
  @user_cache_pool :frontdesk_user

  setup do
    Cache.clear(@login_cache_pool)
    Cache.clear(@user_cache_pool)
    :ok
  end

  describe "[get userid]" do
    test "userid should work" do
      {:ok, user} = db_insert(:user)

      {:ok, user_id} = Accounts.FrontDesk.userid(user.login)
      assert user.id == user_id

      assert {:ok, user_id} = Cache.get(@login_cache_pool, user.login)
      assert user_id == user.id
    end
  end

  describe "[cached user]" do
    test "user caches default user by login" do
      {:ok, user} = db_insert(:user)

      assert {:error, nil} = Cache.get(@user_cache_pool, user_scope(user.login))

      assert {:ok, cached_user} = FrontDesk.user(user.login)
      assert cached_user.id == user.id

      assert {:ok, cached_user} = Cache.get(@user_cache_pool, user_scope(user.login))
      assert cached_user.id == user.id
    end

    test "live_user bypasses default user cache" do
      {:ok, user} = db_insert(:user)
      {:ok, _cached_user} = FrontDesk.user(user.login)

      {:ok, _updated} = ORM.update(user, %{nickname: "new nickname"})

      assert {:ok, cached_user} = FrontDesk.user(user.login)
      assert cached_user.nickname != "new nickname"

      assert {:ok, live_user} = FrontDesk.live_user(user.login)
      assert live_user.nickname == "new nickname"
    end

    test "revalidate.user refreshes default user cache" do
      {:ok, user} = db_insert(:user)
      {:ok, _cached_user} = FrontDesk.user(user.login)

      {:ok, _updated} = ORM.update(user, %{nickname: "new nickname"})

      assert {:ok, refreshed_user} = FrontDesk.revalidate().user(user.login)
      assert refreshed_user.nickname == "new nickname"

      assert {:ok, cached_user} = FrontDesk.user(user.login)
      assert cached_user.nickname == "new nickname"
    end
  end

  defp user_scope(login), do: "user:#{login}"
end
