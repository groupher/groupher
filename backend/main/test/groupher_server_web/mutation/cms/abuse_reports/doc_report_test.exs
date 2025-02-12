defmodule GroupherServer.Test.Mutation.AbuseReports.DocReport do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community doc_attrs)a}
  end

  describe "[doc report/undo_report]" do
    @report_query """
    mutation($id: ID!, $reason: String!, $attr: String) {
      reportDoc(id: $id, reason: $reason, attr: $attr) {
        id
        title
      }
    }
    """

    test "login user can report a doc", ~m(community doc_attrs user user_conn)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      variables = %{id: doc.id, reason: "reason"}
      article = user_conn |> mutation_result(@report_query, variables, "reportDoc")

      assert article["id"] == to_string(doc.id)
    end

    @undo_report_query """
    mutation($id: ID!) {
      undoReportDoc(id: $id) {
        id
        title
      }
    }
    """

    test "login user can undo report a doc",
         ~m(community doc_attrs user user_conn)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      variables = %{id: doc.id, reason: "reason"}
      article = user_conn |> mutation_result(@report_query, variables, "reportDoc")

      assert article["id"] == to_string(doc.id)

      variables = %{id: doc.id}

      article = user_conn |> mutation_result(@undo_report_query, variables, "undoReportDoc")
      assert article["id"] == to_string(doc.id)
    end
  end
end
