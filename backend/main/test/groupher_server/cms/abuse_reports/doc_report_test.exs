defmodule GroupherServer.Test.CMS.AbuseReports.DocReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, _, doc_attrs, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community doc_attrs)a}
  end

  describe "[article doc report/unreport]" do
    test "list article reports should work", ~m(community user user2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user2)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)

      report = all_reports.entries |> List.first()
      assert report.article.id == doc.id
      assert report.article.thread == "DOC"
    end

    test "report a doc should have a abuse report record",
         ~m(community user doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert report.article.id == doc.id
      assert all_reports.total_count == 1
      assert report.report_cases_count == 1
      assert List.first(report_cases).user.login == user.login

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.meta.reported_count == 1
      assert user.id in doc.meta.reported_user_ids
    end

    test "can undo a report", ~m(community user doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)
      {:ok, _} = CMS.undo_report_article(:doc, doc.id, user)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)
      assert all_reports.total_count == 0

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert user.id not in doc.meta.reported_user_ids
    end

    test "can undo a existed report", ~m(community user user2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user2)
      {:ok, _} = CMS.undo_report_article(:doc, doc.id, user)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)
      assert all_reports.total_count == 1

      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user2.id in doc.meta.reported_user_ids
      assert user.id not in doc.meta.reported_user_ids
    end

    test "can undo a report with other user report it too",
         ~m(community user user2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user2)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 2
      assert Enum.any?(report.report_cases, &(&1.user.login == user.login))
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))

      {:ok, _} = CMS.undo_report_article(:doc, doc.id, user)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)
      assert all_reports.total_count == 1

      report = all_reports.entries |> List.first()
      assert report.report_cases |> length == 1
      assert Enum.any?(report.report_cases, &(&1.user.login == user2.login))
    end

    test "different user report a comment should have same report with different report cases",
         ~m(community user user2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)

      {:ok, _} =
        CMS.report_article(:doc, doc.id, "reason2", "attr_info 2", user2)

      filter = %{content_type: :doc, content_id: doc.id, page: 1, size: 20}
      {:ok, all_reports} = CMS.paged_reports(filter)

      report = List.first(all_reports.entries)
      report_cases = report.report_cases

      assert all_reports.total_count == 1
      assert length(report_cases) == 2
      assert report.report_cases_count == 2

      assert List.first(report_cases).user.login == user.login
      assert List.last(report_cases).user.login == user2.login
    end

    test "same user can not report a comment twice", ~m(community doc_attrs user)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)

      assert {:error, _report} =
               CMS.report_article(:doc, doc.id, "reason", "attr_info", user)
    end
  end
end
