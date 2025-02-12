defmodule GroupherServer.Test.Query.Collects.DocCollect do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, doc} = db_insert(:doc)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn user user2 doc)a}
  end

  describe "[collect users]" do
    @query """
    query(
      $id: ID!
      $thread: Thread
      $filter: PagiFilter!
    ) {
      collectedUsers(id: $id, thread: $thread, filter: $filter) {
        entries {
          login
          avatar
          nickname
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """

    test "guest can get collected users list after collect a doc",
         ~m(guest_conn doc user user2)a do
      {:ok, _} = CMS.collect_article(:doc, doc.id, user)
      {:ok, _} = CMS.collect_article(:doc, doc.id, user2)

      variables = %{id: doc.id, thread: "DOC", filter: %{page: 1, size: 20}}
      results = guest_conn |> query_result(@query, variables, "collectedUsers")

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2

      assert user_exist_in?(user, results["entries"])
      assert user_exist_in?(user2, results["entries"])
    end
  end
end
