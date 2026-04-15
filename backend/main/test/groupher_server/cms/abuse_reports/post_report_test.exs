defmodule GroupherServer.Test.CMS.AbuseReports.PostReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {_, post, _, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 post)a}
  end

  describe "[article post report/unreport]" do
    test "list article reports should work", ~m(user user2 post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user2)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = all_reports.entries |> List.first()
      assert report.article.id == post.id
      assert report.article.thread == :post
    end

    test "report a post should have a abuse report record", ~m(user post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert report.article.id == post.id
      assert all_reports.total_count == 1
      assert report.report_cases_count == 1
      assert List.first(report_cases).user.login == user.login

      {:ok, post} = ORM.find(Post, post.id)
      assert post.meta.reported_count == 1
      assert user.id in post.meta.reported_user_ids
    end

    test "can undo a report", ~m(user post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.undo_article(post, user)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 0

      {:ok, post} = ORM.find(Post, post.id)
      assert user.id not in post.meta.reported_user_ids
    end

    test "can undo a existed report", ~m(user user2 post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user2)
      {:ok, _} = CMS.AbuseReports.undo_article(post, user)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      {:ok, post} = ORM.find(Post, post.id)

      assert user2.id in post.meta.reported_user_ids
      assert user.id not in post.meta.reported_user_ids
    end

    test "can undo a report with other user report it too", ~m(user user2 post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user2)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 2
      assert Enum.any?(report.report_cases, &(&1.user.login == user.login))
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))

      {:ok, _} = CMS.AbuseReports.undo_article(post, user)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 1
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))
    end

    test "different user report a comment should have same report with different report cases",
         ~m(user user2 post)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(post, "reason2", "attr_info 2", user2)

      filter = %{content_type: :post, content_id: post.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert all_reports.total_count == 1
      assert length(report_cases) == 2
      assert report.report_cases_count == 2

      assert List.first(report_cases).user.login == user.login
      assert List.last(report_cases).user.login == user2.login
    end

    test "same user can not report a comment twice", ~m(post user)a do
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
      assert {:error, _report} = CMS.AbuseReports.article(post, "reason", "attr_info", user)
    end
  end
end
