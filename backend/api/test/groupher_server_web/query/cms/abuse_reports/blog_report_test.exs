defmodule GroupherServer.Test.Query.AbuseReports.BlogReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, blog, blog_attrs, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community blog blog_attrs user user2)a}
  end

  describe "[query paged_blogs filter pagination]" do
    # id
    @query S.Moderation.q(:paged_abuse_reports)
    test "should get pagination info", ~m(guest_conn community blog_attrs user user2)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, _} = CMS.AbuseReports.article(blog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(blog2, "reason", "attr_info", user2)

      variables = %{filter: %{content_type: "BLOG", page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2
    end

    test "support search with id", ~m(guest_conn community blog_attrs user user2)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, _} = CMS.AbuseReports.article(blog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(blog2, "reason", "attr_info", user2)

      variables = %{
        filter: %{content_type: "BLOG", content_id: blog.id, page: 1, size: 10}
      }

      results = guest_conn |> gq_query(@query, variables)

      report = results["entries"] |> List.first()

      assert get_in(report, ["article", "thread"]) == "BLOG"
      assert get_in(report, ["article", "innerId"]) == to_string(blog.inner_id)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1
    end

    test "support comment", ~m(guest_conn community blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.AbuseReports.comment(comment, mock_comment(), "attr", user)

      variables = %{filter: %{content_type: "COMMENT", page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      report =
        Enum.find(
          results["entries"],
          &(get_in(&1, ["comment", "innerId"]) == to_string(comment.inner_id))
        )

      assert not is_nil(report)
      report_case = get_in(report, ["reportCases"])
      assert is_list(report_case)

      assert get_in(report, ["comment", "bodyHtml"]) |> String.contains?(~s(comment</p>))
      assert get_in(report, ["comment", "innerId"]) == to_string(comment.inner_id)
      assert not is_nil(get_in(report, ["comment", "author", "login"]))
    end
  end
end
