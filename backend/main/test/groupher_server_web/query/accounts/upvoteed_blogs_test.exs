defmodule GroupherServer.Test.Query.Accounts.UpvotedBlogs do
  @moduledoc false
  use GroupherServer.TestTools

  @total_count 20

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, blogs} = db_insert_multi(:blog, @total_count)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn user blogs)a}
  end

  describe "[accounts upvoted blogs]" do
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
    test "both login and un-login user can get one's paged upvoted blogs",
         ~m(user_conn guest_conn blogs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(blogs, fn blog ->
        {:ok, _} = CMS.upvote_article(blog, user)
      end)

      variables = %{
        login: user.login,
        filter: %{thread: "BLOG", page: 1, size: 20}
      }

      results = user_conn |> query_result(@query, variables, "pagedUpvotedArticles")
      results2 = guest_conn |> query_result(@query, variables, "pagedUpvotedArticles")

      assert results["totalCount"] == @total_count
      assert results2["totalCount"] == @total_count
    end

    test "if no thread filter will get all paged upvoted articles",
         ~m(guest_conn blogs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(blogs, fn blog ->
        {:ok, _} = CMS.upvote_article(blog, user)
      end)

      variables = %{
        login: user.login,
        filter: %{page: 1, size: 20}
      }

      results = guest_conn |> query_result(@query, variables, "pagedUpvotedArticles")

      assert results["totalCount"] == @total_count
    end
  end
end
