defmodule GroupherServer.Test.Mutation.Accounts.Fans do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = simu_conn(:user, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[Accounts follower]" do
    @query S.Social.m(:follow)
    test "login user can follow other user", ~m(user_conn)a do
      {:ok, user2} = db_insert(:user)

      variables = %{login: user2.login}
      followed = user_conn |> gq_mutation(@query, variables)

      assert followed["login"] == user2.login
      assert followed["viewerHasFollowed"] == false
    end

    test "login user follow other user twice fails", ~m(user_conn)a do
      {:ok, user2} = db_insert(:user)

      variables = %{login: user2.login}
      followed = user_conn |> gq_mutation(@query, variables)
      assert followed["login"] == user2.login

      assert user_conn |> mutation_error?(@query, variables, ecode(:already_did))
    end

    test "login user follow self fails", ~m(user_conn user)a do
      variables = %{login: user.login}
      assert user_conn |> mutation_error?(@query, variables, ecode(:self_conflict))
    end

    test "login user follow no-exist user fails", ~m(user_conn)a do
      variables = %{login: non_exist_login()}

      assert user_conn |> mutation_error?(@query, variables, ecode(:not_exist))
    end

    test "unauth user follow other user fails", ~m(guest_conn)a do
      {:ok, user2} = db_insert(:user)
      variables = %{login: user2.login}
      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end

    @query S.Social.m(:undo_follow)
    test "login user can undo follow other user", ~m(user_conn user)a do
      {:ok, user2} = db_insert(:user)
      {:ok, _} = user |> Accounts.Fans.follow(user2)

      {:ok, found} = User |> ORM.find(user2.id, preload: :followers)
      assert found |> Map.get(:followers) |> length == 1

      variables = %{login: user2.login}
      result = user_conn |> gq_mutation(@query, variables)

      assert result["login"] == user2.login

      {:ok, found} = User |> ORM.find(user2.id, preload: :followers)
      assert found |> Map.get(:followers) |> length == 0

      {:ok, found} = User |> ORM.find(user2.id, preload: :followings)
      assert found |> Map.get(:followings) |> length == 0
    end
  end
end
