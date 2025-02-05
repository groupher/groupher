defmodule GroupherServer.Test.Query.Accounts.UpvotedDocs do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  @total_count 20

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, docs} = db_insert_multi(:doc, @total_count)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn user docs)a}
  end

  describe "[accounts upvoted docs]" do
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

    test "both login and unlogin user can get one's paged upvoteded docs",
         ~m(user_conn guest_conn docs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(docs, fn doc ->
        {:ok, _} = CMS.upvote_article(:doc, doc.id, user)
      end)

      variables = %{
        login: user.login,
        filter: %{thread: "DOC", page: 1, size: 20}
      }

      results = user_conn |> query_result(@query, variables, "pagedUpvotedArticles")
      results2 = guest_conn |> query_result(@query, variables, "pagedUpvotedArticles")

      assert results["totalCount"] == @total_count
      assert results2["totalCount"] == @total_count
    end

    test "if no thread filter will get alll paged upvoteded articles",
         ~m(guest_conn docs)a do
      {:ok, user} = db_insert(:user)

      Enum.each(docs, fn doc ->
        {:ok, _} = CMS.upvote_article(:doc, doc.id, user)
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
