defmodule GroupherServer.Test.Query.PagedArticles.PagedBlogs do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Model.{Article, ArticleStats}
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat

  @page_size GroupherServerWeb.Config.page_size()

  @today_count 3
  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {community, blog, _, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    blog_last_week = set_article_times(blog, @last_week)

    {_, blog, _, _} = mock_article(:blog)

    blog_last_month = set_article_times(blog, @last_month)

    {community, blog, _, user} = mock_article(:blog, community, user)

    blog_last_year = set_article_times(blog, @last_year)

    db_insert_multi(:blog, @today_count)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 blog_last_week blog_last_month blog_last_year community)a}
  end

  defp set_article_times(article, timestamp) do
    article.id
    |> then(&Repo.get!(Article, &1))
    |> Ecto.Changeset.change(inserted_at: timestamp, active_at: timestamp)
    |> Repo.update!()

    article
  end

  describe "[query paged_blogs filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] >= @total_count
      assert results["entries"] |> List.first() |> Map.get("communityTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "PUBLISH"}}

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      assert first_blog["innerId"] > article_inner_id(blog, community)
    end

    test "upvotes_count order should work",
         ~m(guest_conn community blog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "UPVOTES"}}

      {:ok, _} = CMS.Interactions.upvote(blog_last_week, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(blog_last_week, user2, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(blog_last_week, user3, Ecto.UUID.generate())

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()

      assert first_blog["innerId"] === to_string(article_inner_id(blog_last_week, community))
    end

    test "comments_count order should work",
         ~m(guest_conn community blog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "COMMENTS"}}
      blog_id = article_inner_id(blog_last_week, community)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog_id,
          mock_comment(),
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog_id,
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog_id,
          mock_comment(),
          user3,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      assert first_blog["innerId"] === to_string(article_inner_id(blog_last_week, community))
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "VIEWS"}}

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      track_view(blog, user)
      track_view(blog, user2)
      track_view(blog, user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      first_blog = results["entries"] |> List.first()
      assert first_blog["innerId"] == to_string(article_inner_id(blog, community))
    end

    test "should get valid article document", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.Articles.create(community, :blog, blog_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      blog = results["entries"] |> List.first()

      assert not is_nil(get_in(blog, ["document", "html"]))
    end

    test "support community_tag filter", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :blog,
          community_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} = CMS.Communities.set_tag(blog, community_tag.id, user, Ecto.UUID.generate())

      variables = %{filter: %{page: 1, size: 10, community_tag: community_tag.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      variables = %{filter: %{page: 1, size: 10, community_tags: [community_tag.slug]}}
      results2 = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      assert results == results2

      blog = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(community_tag, blog["communityTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :blog, blog_attrs, user)
      blog_attrs2 = mock_attrs(:blog, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :blog, blog_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      blog = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{slug: community.slug}, blog["communities"])
    end

    test "returns cancan error when community blog thread is disabled",
         ~m(guest_conn community user)a do
      {:ok, _} =
        CMS.Dashboard.update(
          community,
          :enable,
          %{
            blog: false
          },
          user,
          Ecto.UUID.generate()
        )

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :blog),
               variables,
               ErrorCat.code(ArticleErrorCat.thread_not_visible())
             )
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :blog),
               variables,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :blog),
               variables_0,
               ErrorCat.code(WebErrorCat.pagination())
             )

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :blog),
               variables_neg_1,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] >= @total_count
    end
  end

  describe "[query paged_blogs filter sort]" do
    test "filter community should get blogs which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert length(results["entries"]) == 3

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] == to_string(article_inner_id(blog, community))))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      blog = results["entries"] |> List.first()

      assert blog["inserted_at"] == blog["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work", ~m(guest_conn community blog_last_year)a do
      Repo.update_all(
        from(summary in ArticleStats,
          where: summary.thread == :blog and summary.article_id == ^blog_last_year.id
        ),
        set: [views: 10, views_revision: 1, snapshot_at: DateTime.utc_now(:second)]
      )

      most_views_blog =
        ArticleStats
        |> where([summary], summary.thread == :blog)
        |> order_by(desc: :views)
        |> limit(1)
        |> Repo.one()

      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      find_blog = results |> Map.get("entries") |> hd

      assert most_views_blog.article_id == blog_last_year.id
      assert find_blog["innerId"] == to_string(article_inner_id(blog_last_year, community))
    end
  end

  describe "[query paged_blogs private state boundary]" do
    test "public content never exposes viewer-private fields", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
      {:ok, _} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
      {:ok, _} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      assert results["totalCount"] == 5

      the_blog =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(blog, community)))
        )

      refute Map.has_key?(the_blog, "viewerHasViewed")
      refute Map.has_key?(the_blog, "viewerHasUpvoted")
      refute Map.has_key?(the_blog, "viewerHasCollected")
      refute Map.has_key?(the_blog, "viewerHasReported")

      track_view(blog, user)

      {:ok, _} = CMS.Interactions.upvote(blog, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.collect(blog, user, Ecto.UUID.generate())
      {:ok, _} = CMS.AbuseReports.article(blog, "reason", "attr_info", user, Ecto.UUID.generate())

      results = user_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      the_blog =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(blog, community)))
        )

      refute Map.has_key?(the_blog, "viewerHasViewed")
      refute Map.has_key?(the_blog, "viewerHasUpvoted")
      refute Map.has_key?(the_blog, "viewerHasCollected")
      refute Map.has_key?(the_blog, "viewerHasReported")

      assert user_exist_in?(user, the_blog["meta"]["latestUpvotedUsers"])
    end
  end

  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_blogs filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn community blog_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results["entries"]
             |> Enum.any?(
               &(&1["innerId"] != to_string(article_inner_id(blog_last_year, community)))
             )
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") >= expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results |> Map.get("totalCount") >= @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn community blog_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] != article_inner_id(blog_last_month, community)))
    end
  end

  describe "[paged blogs active_at]" do
    test "latest commented blog should appear on top",
         ~m(guest_conn community blog_last_week user user2)a do
      {:ok, _current_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
      variables = %{filter: %{page: 1, size: 20, community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()
      assert first_blog["innerId"] !== to_string(article_inner_id(blog_last_week, community))

      Process.sleep(2000)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          article_inner_id(blog_last_week, community),
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] == to_string(article_inner_id(blog_last_week, community))
    end

    test "comment on very old blog have no effect",
         ~m(guest_conn community blog_last_year user2 user)a do
      variables = %{filter: %{page: 1, size: 20, community: community.slug}}

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          article_inner_id(blog_last_year, community),
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] !== to_string(article_inner_id(blog_last_year, community))
    end

    test "latest blog author commented blog have no effect",
         ~m(guest_conn community blog_last_week user)a do
      {:ok, _current_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
      variables = %{filter: %{page: 1, size: 20, community: community.slug}}

      blog =
        blog_last_week.id
        |> then(&Repo.get!(Article, &1))
        |> Repo.preload(author: :user)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :blog,
          article_inner_id(blog, community),
          mock_comment(),
          blog.author.user,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      entries = results["entries"]
      first_blog = entries |> List.first()

      assert first_blog["innerId"] !== to_string(article_inner_id(blog_last_week, community))
    end
  end

  defp track_view(article, user) do
    assert {:ok, %{tracked: true}} =
             track_article_view(article, user, read_purpose: :public_read)
  end
end
