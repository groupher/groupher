defmodule GroupherServer.Test.Query.Account.Fans do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[account followers]" do
    @query S.Social.q(:paged_followers)
    test "login user can get basic paged followers info", ~m(user)a do
      variables = %{login: user.login, filter: %{page: 1, size: 20}}

      {:ok, user2} = db_insert(:user)
      {:ok, user3} = db_insert(:user)

      {:ok, _} = Accounts.Fans.follow(user2, user)
      {:ok, _} = Accounts.Fans.follow(user3, user)

      user_conn = simu_conn(:user, user)
      results = user_conn |> gq_query(@query, variables)

      assert results |> Map.get("totalCount") == 2
      entries = results |> Map.get("entries")

      assert entries |> List.first() |> Map.get("viewerBeenFollowed")
      assert entries |> List.last() |> Map.get("viewerBeenFollowed")

      assert user2 |> exist_in?(entries)
      assert user3 |> exist_in?(entries)
    end

    test "login user can get other user's paged followers", ~m(guest_conn user)a do
      {:ok, user2} = db_insert(:user)
      {:ok, _} = user |> Accounts.Fans.follow(user2)

      variables = %{login: user2.login, filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> Map.get("totalCount") == 1
      entries = results |> Map.get("entries")

      assert user |> exist_in?(entries)
    end

    @query S.Social.q(:paged_followings)
    test "login user can get it's own paged followings", ~m(user_conn user)a do
      variables = %{login: user.login, filter: %{page: 1, size: 20}}

      {:ok, user2} = db_insert(:user)
      {:ok, user3} = db_insert(:user)
      {:ok, user4} = db_insert(:user)

      {:ok, _} = user |> Accounts.Fans.follow(user2)
      {:ok, _} = user |> Accounts.Fans.follow(user3)
      {:ok, _} = user |> Accounts.Fans.follow(user4)

      results = user_conn |> gq_query(@query, variables)

      assert results |> Map.get("totalCount") == 3
      entries = results |> Map.get("entries")

      assert entries |> List.first() |> Map.get("viewerHasFollowed")
      assert entries |> List.last() |> Map.get("viewerHasFollowed")

      assert user2 |> exist_in?(entries)
      assert user3 |> exist_in?(entries)
      assert user4 |> exist_in?(entries)
    end

    test "login user can get other user's paged followings", ~m(guest_conn user)a do
      {:ok, user2} = db_insert(:user)
      {:ok, _followeer} = user |> Accounts.Fans.follow(user2)

      variables = %{login: user.login, filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> Map.get("totalCount") == 1
      assert results["entries"] |> Enum.any?(&(&1["login"] == user2.login))
    end

    @query S.Social.q(:user)
    test "can get user's followersCount", ~m(user_conn user)a do
      total_count = 15
      {:ok, users} = db_insert_multi(:user, total_count)

      Enum.each(users, fn other_user ->
        {:ok, _} = other_user |> Accounts.Fans.follow(user)
      end)

      variables = %{login: user.login}
      results = user_conn |> gq_query(@query, variables)

      assert results |> Map.get("followersCount") == total_count
    end

    @query S.Social.q(:user_2)
    test "can get user's followingsCount", ~m(user_conn user)a do
      total_count = 15
      {:ok, users} = db_insert_multi(:user, total_count)

      Enum.each(users, fn cool_user ->
        {:ok, _} = user |> Accounts.Fans.follow(cool_user)
      end)

      # make some noise
      {:ok, [user2, user3]} = db_insert_multi(:user, 2)
      {:ok, _} = user2 |> Accounts.Fans.follow(user3)

      variables = %{login: user.login}
      results = user_conn |> gq_query(@query, variables)
      assert results |> Map.get("followingsCount") == total_count
    end

    @query S.Social.q(:user_3)
    test "login user can check if 'i' has followed this user", ~m(user_conn user)a do
      {:ok, user2} = db_insert(:user)

      variables = %{login: user2.login}
      results = user_conn |> gq_query(@query, variables)
      assert results |> Map.get("viewerHasFollowed") == false

      {:ok, _} = user |> Accounts.Fans.follow(user2)
      variables = %{login: user2.login}
      results = user_conn |> gq_query(@query, variables)

      assert results |> Map.get("viewerHasFollowed") == true
    end

    @query S.Social.q(:user_4)
    test "login user can check if 'i' was been followed", ~m(user)a do
      {:ok, user2} = db_insert(:user)
      user_conn = simu_conn(:user, user2)

      variables = %{login: user.login}
      results = user_conn |> gq_query(@query, variables)
      assert results |> Map.get("viewerBeenFollowed") == false

      {:ok, _} = Accounts.Fans.follow(user, user2)
      variables = %{login: user.login}

      results = user_conn |> gq_query(@query, variables)

      assert results |> Map.get("viewerBeenFollowed") == true
    end
  end
end
