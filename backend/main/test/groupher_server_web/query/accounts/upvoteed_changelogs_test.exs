defmodule GroupherServer.Test.Query.Accounts.UpvotedChangelogs do
  @moduledoc false
  use GroupherServer.TestTools

  @total_count 20

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, changelogs} = db_insert_multi(:changelog, @total_count)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn user changelogs)a}
  end

  describe "[accounts upvoted changelogs]" do
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
    test "both login and unlogin user can get one's paged upvoted changelogs",
         ~m(user_conn guest_conn changelogs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(changelogs, fn changelog ->
        {:ok, _} = CMS.Articles.upvote(changelog, user)
      end)

      variables = %{
        login: user.login,
        filter: %{thread: "CHANGELOG", page: 1, size: 20}
      }

      results = user_conn |> gq_query(@query, variables)
      results2 = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == @total_count
      assert results2["totalCount"] == @total_count
    end

    test "if no thread filter will get all paged upvoted articles",
         ~m(guest_conn changelogs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(changelogs, fn changelog ->
        {:ok, _} = CMS.Articles.upvote(changelog, user)
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
