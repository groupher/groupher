defmodule GroupherServer.Test.CMS.AbuseReports.ChangelogReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {_, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 changelog)a}
  end

  describe "[article changelog report/un-report]" do
    test "list article reports should work", ~m(user user2 changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user2)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = all_reports.entries |> List.first()
      assert report.article.id == changelog.id
      assert report.article.thread == "CHANGELOG"
    end

    test "report a changelog should have a abuse report record", ~m(user changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert report.article.id == changelog.id
      assert all_reports.total_count == 1
      assert report.report_cases_count == 1
      assert List.first(report_cases).user.login == user.login

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert changelog.meta.reported_count == 1
      assert user.id in changelog.meta.reported_user_ids
    end

    test "can undo a report", ~m(user changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.undo_article(changelog, user)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 0

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert user.id not in changelog.meta.reported_user_ids
    end

    test "can undo a existed report", ~m(user user2 changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user2)
      {:ok, _} = CMS.AbuseReports.undo_article(changelog, user)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user2.id in changelog.meta.reported_user_ids
      assert user.id not in changelog.meta.reported_user_ids
    end

    test "can undo a report with other user report it too", ~m(user user2 changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user2)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 2
      assert Enum.any?(report.report_cases, &(&1.user.login == user.login))
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))

      {:ok, _} = CMS.AbuseReports.undo_article(changelog, user)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 1
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))
    end

    test "different user report a comment should have same report with different report cases",
         ~m(user user2 changelog)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason2", "attr_info 2", user2)

      filter = %{content_type: :changelog, content_id: changelog.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.AbuseReports.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert all_reports.total_count == 1
      assert length(report_cases) == 2
      assert report.report_cases_count == 2

      assert List.first(report_cases).user.login == user.login
      assert List.last(report_cases).user.login == user2.login
    end

    test "same user can not report a comment twice", ~m(changelog user)a do
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)

      assert {:error, _report} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)
    end
  end
end
