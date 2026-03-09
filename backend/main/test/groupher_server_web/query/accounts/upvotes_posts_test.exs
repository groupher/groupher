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
    @query """
    query($login: String!, $filter: UpvotedArticlesFilter!) {
      pagedUpvotedArticles(login: $login, filter: $filter) {
        entries {
          id
          title
          thread
        }
        totalCount
      }
    }
    """
    test "both login and unlogin user can get one's paged upvoted posts",
         ~m(user_conn guest_conn posts)a do
      {:ok, user} = db_insert(:user)

      Enum.each(posts, fn post ->
        {:ok, _} = CMS.Articles.upvote(post, user)
      end)

      variables = %{
        login: user.login,
        filter: %{thread: "POST", page: 1, size: 20}
      }

      results = user_conn |> gq_query(@query, variables)
      results2 = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == @total_count
      assert results2["totalCount"] == @total_count
    end

    test "if no thread filter will get all paged upvoted articles",
         ~m(guest_conn posts)a do
      {:ok, user} = db_insert(:user)

      Enum.each(posts, fn post ->
        {:ok, _} = CMS.Articles.upvote(post, user)
      end)

      variables = %{
        login: user.login,
        filter: %{page: 1, size: 20}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == @total_count
    end
  end
end
