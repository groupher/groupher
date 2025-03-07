defmodule GroupherServer.Test.CMS.AbuseReports.CommentReport do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user community user2 post)a}
  end

  describe "[article comment report/unreport]" do
    @tag :wip
    test "report a comment should have a abuse report record", ~m(user community post)a do
      {:ok, comment} = CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)
      {:ok, _} = CMS.report_comment(comment.id, mock_comment(), "attr", user)

      filter = %{content_type: :comment, content_id: comment.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases
      assert report.comment.id == comment.id

      assert all_reports.total_count == 1
      assert report.report_cases_count == 1
      assert List.first(report_cases).user.login == user.login
    end

    @tag :wip
    test "different user report a comment should have same report with different report cases",
         ~m(user user2 community post)a do
      {:ok, comment} = CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)
      {:ok, _} = CMS.report_comment(comment.id, mock_comment(), "attr", user)
      {:ok, _} = CMS.report_comment(comment.id, mock_comment(), "attr", user2)

      filter = %{content_type: :comment, content_id: comment.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert all_reports.total_count == 1
      assert length(report_cases) == 2
      assert report.report_cases_count == 2

      assert List.first(report_cases).user.login == user.login
      assert List.last(report_cases).user.login == user2.login
    end

    @tag :wip
    test "same user can not report a comment twice", ~m(user community post)a do
      {:ok, comment} = CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)
      {:ok, comment} = CMS.report_comment(comment.id, mock_comment(), "attr", user)
      assert {:error, _} = CMS.report_comment(comment.id, mock_comment(), "attr", user)
    end
  end
end
