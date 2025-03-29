defmodule GroupherServer.Test.Query.AbuseReports.PostReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, post_attrs, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community post post_attrs user user2)a}
  end

  describe "[query paged_posts filter pagination]" do
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
    @tag :wip
    test "should get pagination info", ~m(guest_conn community post_attrs user user2)a do
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, post2} = CMS.create_article(community, :post, post_attrs, user)

      {:ok, _} = CMS.report_article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.report_article(post2, "reason", "attr_info", user2)

      variables = %{filter: %{content_type: "POST", page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedAbuseReports")

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2
    end

    @tag :wip
    test "support search with id", ~m(guest_conn community post_attrs user user2)a do
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, post2} = CMS.create_article(community, :post, post_attrs, user)

      {:ok, _} = CMS.report_article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.report_article(post2, "reason", "attr_info", user2)

      variables = %{filter: %{content_type: "POST", content_id: post.id, page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedAbuseReports")

      report = results["entries"] |> List.first()

      assert get_in(report, ["article", "thread"]) == "POST"
      assert get_in(report, ["article", "id"]) == to_string(post.id)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1
    end

    test "support comment", ~m(guest_conn community post user)a do
      {:ok, comment} =
        CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)

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
