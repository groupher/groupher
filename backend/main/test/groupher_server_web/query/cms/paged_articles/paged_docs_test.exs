defmodule GroupherServer.Test.Query.PagedArticles.PagedDocs do
  @moduledoc false

  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias GroupherServer.Repo

  alias CMS.Model.Doc

  @page_size get_config(:general, :page_size)

  @now Timex.now()
  @last_week Timex.shift(Timex.beginning_of_week(@now), days: -1, seconds: -1)
  @last_month Timex.shift(Timex.beginning_of_month(@now), days: -1, seconds: -1)
  @last_year Timex.shift(Timex.beginning_of_year(@now), days: -3, seconds: -1)

  @today_count 15

  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, doc_last_month} = db_insert(:doc, %{title: "last month", inserted_at: @last_month})

    {:ok, doc_last_week} =
      db_insert(:doc, %{title: "last week", inserted_at: @last_week, active_at: @last_week})

    {:ok, doc_last_year} =
      db_insert(:doc, %{title: "last year", inserted_at: @last_year, active_at: @last_year})

    db_insert_multi(:doc, @today_count)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user doc_last_week doc_last_month doc_last_year)a}
  end

  describe "[query paged_docs filter pagination]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          document {
            bodyHtml
          }
          communities {
            id
            slug
          }
          articleTags {
            id
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """

    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] == @total_count
      assert results["entries"] |> List.first() |> Map.get("articleTags") |> is_list
    end

    test "should get valid thread document", ~m(guest_conn)a do
      {:ok, user} = db_insert(:user)
      {:ok, community} = db_insert(:community)
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.create_article(community, :doc, doc_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      doc = results["entries"] |> List.first()

      assert not is_nil(get_in(doc, ["document", "bodyHtml"]))
    end

    test "support article_tag filter", ~m(guest_conn user)a do
      {:ok, community} = db_insert(:community)
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)
      {:ok, _} = CMS.set_article_tag(:doc, doc.id, article_tag.id)

      variables = %{filter: %{page: 1, size: 10, article_tag: article_tag.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      variables = %{filter: %{page: 1, size: 10, article_tags: [article_tag.slug]}}
      results2 = guest_conn |> query_result(@query, variables, "pagedDocs")
      assert results == results2

      doc = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(article_tag, doc["articleTags"])
    end

    test "support community filter", ~m(guest_conn user)a do
      {:ok, community} = db_insert(:community)

      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :doc, doc_attrs, user)
      doc_attrs2 = mock_attrs(:doc, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :doc, doc_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      doc = results["entries"] |> List.first()
      assert results["totalCount"] == 2
      assert exist_in?(%{id: to_string(community.id)}, doc["communities"])
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}
      assert guest_conn |> query_get_error?(@query, variables, ecode(:pagination))
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn |> query_get_error?(@query, variables_0, ecode(:pagination))
      assert guest_conn |> query_get_error?(@query, variables_neg_1, ecode(:pagination))
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count
    end
  end

  describe "[query paged_docs filter sort]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          inserted_at
          active_at
          author {
            id
            nickname
            avatar
          }
          communities {
            id
            slug
          }
        }
       }
    }
    """

    test "filter community should get docs which belongs to that community",
         ~m(guest_conn user)a do
      {:ok, community} = db_insert(:community)
      {:ok, doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert length(results["entries"]) == 1
      assert results["entries"] |> Enum.any?(&(&1["id"] == to_string(doc.id)))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn user)a do
      {:ok, community} = db_insert(:community)
      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      doc = results["entries"] |> List.first()

      assert doc["inserted_at"] == doc["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      active_timestamps = results["entries"] |> Enum.map(& &1["active_at"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          views
        }
      }
    }
    """

    test "filter sort MOST_VIEWS should work", ~m(guest_conn)a do
      most_views_doc = Doc |> order_by(desc: :views) |> limit(1) |> Repo.one()
      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      find_doc = results |> Map.get("entries") |> hd

      # assert find_doc["id"] == most_views_doc |> Map.get(:id) |> to_string
      assert find_doc["views"] == most_views_doc |> Map.get(:views)
    end
  end

  describe "[query paged_docs filter has_xxx]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          viewerHasCollected
          viewerHasUpvoted
          viewerHasViewed
          viewerHasReported
          meta {
            latestUpvotedUsers {
              login
            }
          }
        }
        totalCount
      }
    }
    """

    test "has_xxx state should work", ~m(user)a do
      user_conn = simu_conn(:user, user)
      {:ok, community} = db_insert(:community)

      {:ok, doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> query_result(@query, variables, "pagedDocs")
      assert results["totalCount"] == 3

      the_doc = Enum.find(results["entries"], &(&1["id"] == to_string(doc.id)))
      assert not the_doc["viewerHasViewed"]
      assert not the_doc["viewerHasUpvoted"]
      assert not the_doc["viewerHasCollected"]
      assert not the_doc["viewerHasReported"]

      {:ok, _} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)
      {:ok, _} = CMS.upvote_article(:doc, doc.id, user)
      {:ok, _} = CMS.collect_article(:doc, doc.id, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)

      results = user_conn |> query_result(@query, variables, "pagedDocs")

      the_doc = Enum.find(results["entries"], &(&1["id"] == to_string(doc.id)))
      assert the_doc["viewerHasViewed"]
      assert the_doc["viewerHasUpvoted"]
      assert the_doc["viewerHasCollected"]
      assert the_doc["viewerHasReported"]

      assert user_exist_in?(user, the_doc["meta"]["latestUpvotedUsers"])
    end
  end

  # TODO test  sort, tag, community, when ...
  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_docs filter when]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          views
          inserted_at
        }
        totalCount
      }
    }
    """

    test "THIS_YEAR option should work", ~m(guest_conn doc_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results["entries"] |> Enum.any?(&(&1["id"] != doc_last_year.id))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") == expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results |> Map.get("totalCount") == @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn doc_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results["entries"] |> Enum.any?(&(&1["id"] != doc_last_month.id))
    end
  end

  describe "[paged docs active_at]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          insertedAt
          activeAt
        }
      }
    }
    """

    test "latest commented doc should appear on top",
         ~m(guest_conn doc_last_week user)a do
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      entries = results["entries"]
      first_doc = entries |> List.first()
      assert first_doc["id"] !== to_string(doc_last_week.id)

      Process.sleep(1500)

      {:ok, _comment} = CMS.create_comment(:doc, doc_last_week.id, mock_comment(), user)

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["id"] == to_string(doc_last_week.id)
    end

    test "comment on very old doc have no effect",
         ~m(guest_conn doc_last_year user)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _comment} = CMS.create_comment(:doc, doc_last_year.id, mock_comment(), user)

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["id"] !== to_string(doc_last_year.id)
    end

    test "latest doc author commented doc have no effect",
         ~m(guest_conn doc_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _comment} =
        CMS.create_comment(
          :doc,
          doc_last_week.id,
          mock_comment(),
          doc_last_week.author.user
        )

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["id"] !== to_string(doc_last_week.id)
    end
  end
end
