defmodule GroupherServer.Test.Mutation.AbuseReports.ChangelogReport do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog_attrs)a}
  end

  describe "[changelog report/undo_report]" do
    @report_query """
    mutation($id: ID!, $reason: String!, $attr: String) {
      reportChangelog(id: $id, reason: $reason, attr: $attr) {
        id
        title
      }
    }
    """

    test "login user can report a changelog", ~m(community changelog_attrs user user_conn)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      variables = %{id: changelog.id, reason: "reason"}
      article = user_conn |> mutation_result(@report_query, variables, "reportChangelog")

      assert article["id"] == to_string(changelog.id)
    end

    @undo_report_query """
    mutation($id: ID!) {
      undoReportChangelog(id: $id) {
        id
        title
      }
    }
    """

    test "login user can undo report a changelog",
         ~m(community changelog_attrs user user_conn)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      variables = %{id: changelog.id, reason: "reason"}
      article = user_conn |> mutation_result(@report_query, variables, "reportChangelog")

      assert article["id"] == to_string(changelog.id)

      variables = %{id: changelog.id}

      article = user_conn |> mutation_result(@undo_report_query, variables, "undoReportChangelog")
      assert article["id"] == to_string(changelog.id)
    end
  end
end
