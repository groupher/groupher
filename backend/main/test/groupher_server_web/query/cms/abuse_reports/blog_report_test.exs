defmodule GroupherServer.Test.Query.AbuseReports.BlogReport do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, blog} = db_insert(:blog)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community blog blog_attrs user user2)a}
  end

  describe "[query paged_blogs filter pagination]" do
    # id
    @query """
    query($filter: ReportFilter!) {
      pagedAbuseReports(filter: $filter) {
        entries {
          id
          dealWith
          article {
            id
            thread
            title
          }
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

    test "should get pagination info", ~m(guest_conn community blog_attrs user user2)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _report} = CMS.report_article(:blog, blog.id, "reason", "attr_info", user)
      {:ok, _report} = CMS.report_article(:blog, blog2.id, "reason", "attr_info", user2)

      variables = %{filter: %{content_type: "BLOG", page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedAbuseReports")

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2
    end

    test "support search with id", ~m(guest_conn user user2)a do
      {:ok, blog} = db_insert(:blog)
      {:ok, blog2} = db_insert(:blog)

      {:ok, _report} = CMS.report_article(:blog, blog.id, "reason", "attr_info", user)
      {:ok, _report} = CMS.report_article(:blog, blog2.id, "reason", "attr_info", user2)

      variables = %{
        filter: %{content_type: "BLOG", content_id: blog.id, page: 1, size: 10}
      }

      results = guest_conn |> query_result(@query, variables, "pagedAbuseReports")

      report = results["entries"] |> List.first()

      assert get_in(report, ["article", "thread"]) == "BLOG"
      assert get_in(report, ["article", "id"]) == to_string(blog.id)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1
    end

    test "support comment", ~m(guest_conn blog user)a do
      {:ok, comment} = CMS.create_comment(:blog, blog.id, mock_comment(), user)
      {:ok, _} = CMS.report_comment(comment.id, mock_comment(), "attr", user)

      variables = %{filter: %{content_type: "COMMENT", page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedAbuseReports")

      report = results["entries"] |> List.first()
      report_case = get_in(report, ["reportCases"])
      assert is_list(report_case)

      assert get_in(report, ["comment", "bodyHtml"]) |> String.contains?(~s(comment</p>))
      assert get_in(report, ["comment", "id"]) == to_string(comment.id)
      assert not is_nil(get_in(report, ["comment", "author", "login"]))
    end
  end
end
