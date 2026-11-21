defmodule GroupherServer.Test.Query.Accounts.UpvotesPosts do
  @moduledoc false
  use GroupherServer.TestMate

  @total_count 20

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, posts} = db_insert_multi(:post, @total_count)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn user posts)a}
  end

  describe "[accounts upvotes posts]" do
    @query S.Social.q(:paged_upvoted_articles)

    test "GraphQL common_article resolves the author in upvoted article entries",
         ~m(guest_conn posts)a do
      {:ok, viewer} = db_insert(:user)
      [post | _] = posts
      {:ok, _} = CMS.Interactions.upvote(post, viewer, Ecto.UUID.generate())

      variables = %{
        login: viewer.login,
        filter: %{thread: "POST"},
        pagi: %{offset: %{page: 1, size: 20}}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert [%{"author" => %{"login" => login}}] = results["entries"]
      assert is_binary(login)
    end

    test "both login and unlogin user can get one's paged upvoted posts",
         ~m(user_conn guest_conn posts)a do
      {:ok, user} = db_insert(:user)

      Enum.each(posts, fn post ->
        {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
      end)

      variables = %{
        login: user.login,
        filter: %{thread: "POST"},
        pagi: %{offset: %{page: 1, size: 20}}
      }

      results = user_conn |> gq_query(@query, variables)
      results2 = guest_conn |> gq_query(@query, variables)

      assert results["pageInfo"]["totalCount"] == @total_count
      assert results2["pageInfo"]["totalCount"] == @total_count
      assert Enum.all?(results["entries"], &is_binary(get_in(&1, ["author", "login"])))
      assert Enum.all?(results2["entries"], &is_binary(get_in(&1, ["author", "login"])))
    end

    test "if no thread filter will get all paged upvoted articles",
         ~m(guest_conn posts)a do
      {:ok, user} = db_insert(:user)

      Enum.each(posts, fn post ->
        {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
      end)

      variables = %{
        login: user.login,
        pagi: %{offset: %{page: 1, size: 20}}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["pageInfo"]["totalCount"] == @total_count
    end
  end
end
