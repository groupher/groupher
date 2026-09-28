defmodule GroupherServer.Test.Query.PagedArticles.PagedDocs do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Model.ArticleStats
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat

  @page_size GroupherServerWeb.Config.page_size()

  @today_count 3
  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {community, doc, _, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, doc_last_week} =
      ORM.update(doc, %{title: "last week", inserted_at: @last_week, active_at: @last_week},
        strict: false
      )

    {_, doc, _, _} = mock_article(:doc)

    {:ok, doc_last_month} =
      ORM.update(
        doc,
        %{title: "last month", inserted_at: @last_month, active_at: @last_month},
        strict: false
      )

    {community, doc, _, user} = mock_article(:doc, community, user)

    {:ok, doc_last_year} =
      ORM.update(doc, %{title: "last year", inserted_at: @last_year, active_at: @last_year},
        strict: false
      )

    {:ok, today_docs} = db_insert_multi(:doc, @today_count)

    Enum.each(today_docs, fn doc ->
      ORM.update(doc, %{active_at: doc.inserted_at}, strict: false)
    end)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user user2 user3 doc_last_week doc_last_month doc_last_year community)a}
  end

  describe "[query paged_docs filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] >= @total_count
      assert results["entries"] |> List.first() |> Map.get("communityTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "PUBLISH"}}

      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      first_doc = results["entries"] |> List.first()
      assert first_doc["innerId"] > doc.inner_id
    end

    test "upvotes_count order should work",
         ~m(guest_conn doc_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "UPVOTES"}}

      {:ok, _} = CMS.Interactions.upvote(doc_last_week, user)
      {:ok, _} = CMS.Interactions.upvote(doc_last_week, user2)
      {:ok, _} = CMS.Interactions.upvote(doc_last_week, user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      first_doc = results["entries"] |> List.first()

      assert first_doc["innerId"] === to_string(doc_last_week.inner_id)
    end

    test "comments_count order should work",
         ~m(guest_conn community doc_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "COMMENTS"}}
      doc_id = doc_last_week.inner_id

      {:ok, _} = CMS.Comments.create_comment(community, :doc, doc_id, mock_comment(), user)
      {:ok, _} = CMS.Comments.create_comment(community, :doc, doc_id, mock_comment(), user2)
      {:ok, _} = CMS.Comments.create_comment(community, :doc, doc_id, mock_comment(), user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      first_doc = results["entries"] |> List.first()
      assert first_doc["innerId"] === to_string(doc_last_week.inner_id)
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "VIEWS"}}

      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      track_view(doc, user)
      track_view(doc, user2)
      track_view(doc, user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      first_doc = results["entries"] |> List.first()
      assert first_doc["innerId"] == to_string(doc.inner_id)
    end

    test "should get valid article document", ~m(guest_conn community user)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.Articles.create(community, :doc, doc_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      doc = results["entries"] |> List.first()

      assert not is_nil(get_in(doc, ["document", "html"]))
    end

    test "support community_tag filter", ~m(guest_conn community user)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      {:ok, _} = CMS.Communities.set_tag(doc, community_tag.id)

      variables = %{filter: %{page: 1, size: 10, community_tag: community_tag.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      variables = %{filter: %{page: 1, size: 10, community_tags: [community_tag.slug]}}
      results2 = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      assert results == results2

      doc = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(community_tag, doc["communityTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :doc, doc_attrs, user)
      doc_attrs2 = mock_attrs(:doc, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :doc, doc_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      doc = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{slug: community.slug}, doc["communities"])
    end

    test "returns cancan error when community doc thread is disabled",
         ~m(guest_conn community)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :enable, %{
          doc: false
        })

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :doc),
               variables,
               ErrorCat.code(ArticleErrorCat.thread_not_visible())
             )
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :doc),
               variables,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :doc),
               variables_0,
               ErrorCat.code(WebErrorCat.pagination())
             )

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :doc),
               variables_neg_1,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] >= @total_count
    end
  end

  describe "[query paged_docs filter sort]" do
    test "filter community should get docs which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert length(results["entries"]) == 3
      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(doc.inner_id)))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      doc = results["entries"] |> List.first()

      assert doc["inserted_at"] == doc["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work", ~m(guest_conn doc_last_year)a do
      Repo.update_all(
        from(summary in ArticleStats,
          where: summary.thread == :doc and summary.article_id == ^doc_last_year.id
        ),
        set: [views: 10, views_revision: 1, snapshot_at: DateTime.utc_now(:second)]
      )

      most_views_doc =
        ArticleStats
        |> where([summary], summary.thread == :doc)
        |> order_by(desc: :views)
        |> limit(1)
        |> Repo.one()

      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      find_doc = results |> Map.get("entries") |> hd

      assert most_views_doc.article_id == doc_last_year.id
      assert find_doc["innerId"] == to_string(doc_last_year.inner_id)
    end
  end

  describe "[query paged_docs private state boundary]" do
    test "public content never exposes viewer-private fields", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      assert results["totalCount"] == 5

      the_doc =
        Enum.find(results["entries"], &(&1["innerId"] == to_string(doc.inner_id)))

      refute Map.has_key?(the_doc, "viewerHasViewed")
      refute Map.has_key?(the_doc, "viewerHasUpvoted")
      refute Map.has_key?(the_doc, "viewerHasCollected")
      refute Map.has_key?(the_doc, "viewerHasReported")

      track_view(doc, user)

      {:ok, _} = CMS.Interactions.upvote(doc, user)
      {:ok, _} = CMS.Interactions.collect(doc, user)
      {:ok, _} = CMS.AbuseReports.article(doc, "reason", "attr_info", user)

      results = user_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      the_doc =
        Enum.find(results["entries"], &(&1["innerId"] == to_string(doc.inner_id)))

      refute Map.has_key?(the_doc, "viewerHasViewed")
      refute Map.has_key?(the_doc, "viewerHasUpvoted")
      refute Map.has_key?(the_doc, "viewerHasCollected")
      refute Map.has_key?(the_doc, "viewerHasReported")

      assert user_exist_in?(user, the_doc["meta"]["latestUpvotedUsers"])
    end
  end

  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_docs filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn doc_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] != to_string(doc_last_year.inner_id)))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") >= expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert results |> Map.get("totalCount") >= @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn doc_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] != doc_last_month.inner_id))
    end
  end

  describe "[paged docs active_at]" do
    test "latest commented doc should appear on top",
         ~m(guest_conn community doc_last_week user2)a do
      {:ok, _fresh_doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user2)

      variables = %{filter: %{page: 1, size: 20, community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      entries = results["entries"]
      first_doc = entries |> List.first()
      assert first_doc["innerId"] !== to_string(doc_last_week.inner_id)

      Process.sleep(2000)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc_last_week.inner_id,
          mock_comment(),
          user2
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["innerId"] == to_string(doc_last_week.inner_id)
    end

    test "comment on very old doc have no effect",
         ~m(guest_conn community doc_last_year user2)a do
      variables = %{filter: %{page: 1, size: 20, community: community.slug}}

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc_last_year.inner_id,
          mock_comment(),
          user2
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["innerId"] !== to_string(doc_last_year.inner_id)
    end

    test "latest doc author commented doc have no effect",
         ~m(guest_conn community doc_last_week)a do
      {:ok, user} = db_insert(:user)
      {:ok, _fresh_doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      variables = %{filter: %{page: 1, size: 20, community: community.slug}}
      {:ok, doc} = ORM.find(Doc, doc_last_week.id, preload: [author: :user])

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc.inner_id,
          mock_comment(),
          doc.author.user
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      entries = results["entries"]
      first_doc = entries |> List.first()

      assert first_doc["innerId"] !== to_string(doc_last_week.inner_id)
    end
  end

  defp track_view(article, user) do
    assert {:ok, %{tracked: true}} =
             track_article_view(article, user, read_purpose: :public_read)
  end
end
