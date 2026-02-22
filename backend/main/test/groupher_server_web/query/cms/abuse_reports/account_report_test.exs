defmodule GroupherServer.Test.Query.AbuseReports.AccountReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user user2)a}
  end

  describe "[query paged_posts filter pagination]" do
    # id
    @query """
    query($filter: ReportFilter!) {
      pagedAbuseReports(filter: $filter) {
        entries {
          id
          dealWith
          operateUser {
            id
            login
          }
          comment {
            id
            bodyHtml
            author {
              login
            }
          }
          account {
            login
          }
          reportCases {
            reason
            attr
            user {
              login
            }
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "should get pagination info", ~m(guest_conn user user2)a do
      {:ok, _} = CMS.AbuseReports.account(user, "reason", "attr_info", user2)

      variables = %{filter: %{content_type: "ACCOUNT", page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      report = results["entries"] |> List.first()
      assert results |> is_valid_pagination?
      assert get_in(report, ["account", "login"]) == user.login
    end
  end
end
