defmodule GroupherServer.Test.Query.PagedArticles.PagedBlogs do
  @moduledoc false

  use GroupherServer.TestTools

  @page_size get_config(:general, :page_size)

  @now Timex.now()
  @last_week Timex.shift(Timex.beginning_of_week(@now), days: -1, seconds: -1)
  @last_month Timex.shift(Timex.beginning_of_month(@now), days: -1, seconds: -1)
  @last_year Timex.shift(Timex.beginning_of_year(@now), days: -3, seconds: -1)

  @today_count 3
  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {community, blog, _, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, blog_last_week} =
      ORM.update(blog, %{title: "last week", inserted_at: @last_week, active_at: @last_week},
        strict: false
      )

    {_, blog, _, _} = mock_article(:blog)

    {:ok, blog_last_month} =
      ORM.update(
        blog,
        %{title: "last month", inserted_at: @last_month, active_at: @last_month},
        strict: false
      )

    {community, blog, _, user} = mock_article(:blog, community, user)

    {:ok, blog_last_year} =
      ORM.update(blog, %{title: "last year", inserted_at: @last_year, active_at: @last_year},
        strict: false
      )

    db_insert_multi(:blog, @today_count)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 blog_last_week blog_last_month blog_last_year community)a}
  end

  describe "[query paged_blogs filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] == @total_count
      assert results["entries"] |> List.first() |> Map.get("articleTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "publish"}}

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      assert first_blog["innerId"] > blog.inner_id
    end

    test "upvotes_count order should work",
         ~m(guest_conn blog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "upvotes"}}

      {:ok, _} = CMS.upvote_article(blog_last_week, user)
      {:ok, _} = CMS.upvote_article(blog_last_week, user2)
      {:ok, _} = CMS.upvote_article(blog_last_week, user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()

      assert first_blog["upvotesCount"] === 3
    end

    test "comments_count order should work",
         ~m(guest_conn community blog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "comments"}}
      blog_id = blog_last_week.inner_id

      {:ok, _} = CMS.create_comment(community, :blog, blog_id, mock_comment(), user)
      {:ok, _} = CMS.create_comment(community, :blog, blog_id, mock_comment(), user2)
      {:ok, _} = CMS.create_comment(community, :blog, blog_id, mock_comment(), user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      assert first_blog["commentsCount"] === 3
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "views"}}

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      {:ok, _} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user2)

      {:ok, _} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      last_blog = results["entries"] |> List.last()
      assert first_blog["views"] > last_blog["views"]
    end

    test "should get valid thread document", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.create_article(community, :blog, blog_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      blog = results["entries"] |> List.first()

      assert not is_nil(get_in(blog, ["document", "bodyHtml"]))
    end

    test "support article_tag filter", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)
      {:ok, _} = CMS.set_article_tag(blog, article_tag.id)

      variables = %{filter: %{page: 1, size: 10, article_tag: article_tag.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      variables = %{filter: %{page: 1, size: 10, article_tags: [article_tag.slug]}}
      results2 = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      assert results == results2

      blog = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(article_tag, blog["articleTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :blog, blog_attrs, user)
      blog_attrs2 = mock_attrs(:blog, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :blog, blog_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      blog = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{id: to_string(community.id)}, blog["communities"])
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}

      assert guest_conn
             |> query_get_error?(Schema.q(:paged_articles, :blog), variables, ecode(:pagination))
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn
             |> query_get_error?(
               Schema.q(:paged_articles, :blog),
               variables_0,
               ecode(:pagination)
             )

      assert guest_conn
             |> query_get_error?(
               Schema.q(:paged_articles, :blog),
               variables_neg_1,
               ecode(:pagination)
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count
    end
  end

  describe "[query paged_blogs filter sort]" do
    test "filter community should get blogs which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert length(results["entries"]) == 3
      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(blog.inner_id)))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      blog = results["entries"] |> List.first()

      assert blog["inserted_at"] == blog["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work", ~m(guest_conn)a do
      most_views_blog = Blog |> order_by(desc: :views) |> limit(1) |> Repo.one()
      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      find_blog = results |> Map.get("entries") |> hd

      # assert find_blog["id"] == most_views_blog |> Map.get(:id) |> to_string
      assert find_blog["views"] == most_views_blog |> Map.get(:views)
    end
  end

  describe "[query paged_blogs filter has_xxx]" do
    test "has_xxx state should work", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)
      {:ok, _} = CMS.create_article(community, :blog, mock_attrs(:blog), user)
      {:ok, _} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      assert results["totalCount"] == 5

      the_blog = Enum.find(results["entries"], &(&1["innerId"] == to_string(blog.inner_id)))

      assert not the_blog["viewerHasViewed"]
      assert not the_blog["viewerHasUpvoted"]
      assert not the_blog["viewerHasCollected"]
      assert not the_blog["viewerHasReported"]

      {:ok, _} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      {:ok, _} = CMS.upvote_article(blog, user)
      {:ok, _} = CMS.collect_article(blog, user)
      {:ok, _} = CMS.report_article(blog, "reason", "attr_info", user)

      results = user_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      the_blog = Enum.find(results["entries"], &(&1["innerId"] == to_string(blog.inner_id)))
      assert the_blog["viewerHasViewed"]
      assert the_blog["viewerHasUpvoted"]
      assert the_blog["viewerHasCollected"]
      assert the_blog["viewerHasReported"]

      assert user_exist_in?(user, the_blog["meta"]["latestUpvotedUsers"])
    end
  end

  # TODO test  sort, tag, community, when ...
  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_blogs filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn blog_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] != blog_last_year.id))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") == expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results |> Map.get("totalCount") == @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn blog_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] != blog_last_month.inner_id))
    end
  end

  describe "[paged blogs active_at]" do
    test "latest commented blog should appear on top",
         ~m(guest_conn community blog_last_week user2)a do
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()
      assert first_blog["innerId"] !== to_string(blog_last_week.inner_id)

      Process.sleep(2000)

      {:ok, _} =
        CMS.create_comment(community, :blog, blog_last_week.inner_id, mock_comment(), user2)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] == to_string(blog_last_week.inner_id)
    end

    test "comment on very old blog have no effect",
         ~m(guest_conn community blog_last_year user2)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _} =
        CMS.create_comment(community, :blog, blog_last_year.inner_id, mock_comment(), user2)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] !== to_string(blog_last_year.inner_id)
    end

    test "latest blog author commented blog have no effect",
         ~m(guest_conn community blog_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}
      {:ok, blog} = ORM.find(Blog, blog_last_week.id, preload: [author: :user])

      {:ok, _} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), blog.author.user)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] !== to_string(blog_last_week.inner_id)
    end
  end
end
