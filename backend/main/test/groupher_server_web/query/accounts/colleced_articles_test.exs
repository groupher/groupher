defmodule GroupherServer.Test.Query.Accounts.CollectedArticles do
  @moduledoc false

  use GroupherServer.TestMate

  @total_count 20

  setup do
    {:ok, user} = db_insert(:user)

    posts =
      Enum.map(1..@total_count, fn inner_id ->
        {:ok, post} = db_insert(:post, %{inner_id: inner_id})
        post
      end)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn user posts)a}
  end

  @query S.Collect.q(:paged_collect_folders)

  test "other user can get other user's paged collect folders", ~m(user_conn guest_conn)a do
    {:ok, user} = db_insert(:user)

    {:ok, _folder} = Accounts.CollectFolders.create(%{title: "test folder"}, user)
    {:ok, _folder} = Accounts.CollectFolders.create(%{title: "test folder2"}, user)

    variables = %{login: user.login, filter: %{page: 1, size: 20}}
    results = user_conn |> gq_query(@query, variables)
    results2 = guest_conn |> gq_query(@query, variables)

    assert results["totalCount"] == 2
    assert results2["totalCount"] == 2

    assert results |> is_valid_pagination?()
    assert results2 |> is_valid_pagination?()
  end

  test "owner can get it's paged collect folders with private folders",
       ~m(user user_conn guest_conn)a do
    {:ok, _folder} = Accounts.CollectFolders.create(%{title: "test folder", private: true}, user)
    {:ok, _folder} = Accounts.CollectFolders.create(%{title: "test folder2"}, user)

    variables = %{login: user.login, filter: %{page: 1, size: 20}}
    results = user_conn |> gq_query(@query, variables)
    results2 = guest_conn |> gq_query(@query, variables)

    assert results["totalCount"] == 2
    assert results2["totalCount"] == 1
  end

  @query S.Collect.q(:paged_collected_articles)
  test "can get paged articles inside a collect-folder", ~m(user_conn guest_conn user posts)a do
    {:ok, folder} = Accounts.CollectFolders.create(%{title: "test folder"}, user)

    Enum.each(posts, fn post ->
      {:ok, _folder} = Accounts.CollectFolders.add(post, folder.id, user)
    end)

    post1 = Enum.at(posts, 0)
    post2 = Enum.at(posts, 1)
    post3 = Enum.at(posts, 2)

    variables = %{folderId: folder.id, filter: %{page: 1, size: 20}}

    results = user_conn |> gq_query(@query, variables)
    results2 = guest_conn |> gq_query(@query, variables)

    assert results["totalCount"] == @total_count
    assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(post1.inner_id)))
    assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(post2.inner_id)))
    assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(post3.inner_id)))

    assert results == results2
  end

  test "can not get collect-folder articles when folder is private", ~m(guest_conn posts)a do
    {:ok, user2} = db_insert(:user)
    {:ok, folder} = Accounts.CollectFolders.create(%{title: "test folder", private: true}, user2)

    Enum.each(posts, fn post ->
      {:ok, _folder} = Accounts.CollectFolders.add(post, folder.id, user2)
    end)

    variables = %{folderId: folder.id, filter: %{page: 1, size: 20}}

    assert guest_conn |> query_error?(@query, variables, ecode(:private_collect_folder))
  end

  test "owner can get collect-folder articles when folder is private",
       ~m(user_conn user posts)a do
    {:ok, folder} = Accounts.CollectFolders.create(%{title: "test folder", private: true}, user)

    Enum.each(posts, fn post ->
      {:ok, _folder} = Accounts.CollectFolders.add(post, folder.id, user)
    end)

    variables = %{folderId: folder.id, filter: %{page: 1, size: 20}}

    results = user_conn |> gq_query(@query, variables)

    assert results["totalCount"] == @total_count
  end
end
