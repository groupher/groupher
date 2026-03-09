defmodule GroupherServer.Test.Query.PagedArticles.PagedPosts do
  @moduledoc false

  use GroupherServer.TestMate

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  @page_size get_config(:general, :page_size)

  @today_count 3
  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {community, post, _, user} = mock_article(:post)

    {:ok, post_last_week} =
      ORM.update(post, %{title: "last week", inserted_at: @last_week, active_at: @last_week},
        strict: false
      )

    {_, post, _, _} = mock_article(:post)

    {:ok, post_last_month} =
      ORM.update(
        post,
        %{title: "last month", inserted_at: @last_month, active_at: @last_month},
        strict: false
      )

    {_, post, _, _} = mock_article(:post, community, user)

    {:ok, post_last_year} =
      ORM.update(post, %{title: "last year", inserted_at: @last_year, active_at: @last_year},
        strict: false
      )

    db_insert_multi(:post, @today_count)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 post_last_week post_last_month post_last_year community)a}
  end

  describe "[query paged_posts filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] == @total_count
      assert results["entries"] |> List.first() |> Map.get("communityTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "publish"}}

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()
      assert first_post["id"] > post.id
    end

    test "upvotes_count order should work", ~m(guest_conn post_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "upvotes"}}

      {:ok, _} = CMS.Articles.upvote(post_last_week, user)
      {:ok, _} = CMS.Articles.upvote(post_last_week, user2)
      {:ok, _} = CMS.Articles.upvote(post_last_week, user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()

      assert first_post["upvotesCount"] === 3
    end

    test "comments_count order should work",
         ~m(guest_conn community post_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "comments"}}
      post_id = post_last_week.inner_id

      {:ok, _} = CMS.Comments.create_comment(community, :post, post_id, mock_comment(), user)
      {:ok, _} = CMS.Comments.create_comment(community, :post, post_id, mock_comment(), user2)
      {:ok, _} = CMS.Comments.create_comment(community, :post, post_id, mock_comment(), user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post, "cat state"), variables)
      first_post = results["entries"] |> List.first()
      assert first_post["commentsCount"] === 3
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "views"}}

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)
      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user2)
      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user3)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()
      last_post = results["entries"] |> List.last()
      assert first_post["views"] > last_post["views"]
    end

    test "should get valid cat & state", ~m(guest_conn post_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _} = CMS.Articles.set_cat(post_last_week, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post_last_week, @article_state.wip)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post, "cat state"), variables)

      assert results["entries"] |> Enum.any?(&(&1["cat"] == "FEATURE"))
      assert results["entries"] |> Enum.any?(&(&1["state"] == "WIP"))
    end

    test "should get valid cat & state by filter", ~m(guest_conn post_last_week)a do
      {:ok, _} = CMS.Articles.set_cat(post_last_week, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post_last_week, @article_state.wip)

      variables = %{filter: %{page: 1, size: 20, cat: "FEATURE"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post, "cat state"), variables)
      assert results["totalCount"] == 1

      variables = %{filter: %{page: 1, size: 20, cat: "NOT_EXIST"}}

      assert guest_conn
             |> query_error?(Schema.q(:paged_articles, :post, "cat state"), variables)

      variables = %{filter: %{page: 1, size: 20, state: "WIP"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post, "cat state"), variables)
      assert results["totalCount"] == 1

      variables = %{filter: %{page: 1, size: 20, state: "NOT_EXIST"}}

      assert guest_conn
             |> query_error?(Schema.q(:paged_articles, :post, "cat state"), variables)

      variables = %{filter: %{page: 1, size: 20, cat: "FEATURE", state: "WIP"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post, "cat state"), variables)
      assert results["totalCount"] == 1
    end

    test "should get valid thread document", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      post = results["entries"] |> List.first()

      assert not is_nil(get_in(post, ["document", "html"]))
    end

    test "support article_tag filter", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      article_tag_attrs = mock_attrs(:community_tag)
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, _} = CMS.Communities.set_tag(post, article_tag.id)

      variables = %{filter: %{page: 1, size: 10, community_tag: article_tag.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      variables = %{filter: %{page: 1, size: 10, community_tags: [article_tag.slug]}}
      results2 = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      assert results == results2

      post = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(%{id: to_string(article_tag.id)}, post["communityTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)
      post_attrs2 = mock_attrs(:post, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      post = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{id: to_string(community.id)}, post["communities"])
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}

      assert guest_conn
             |> query_error?(Schema.q(:paged_articles, :post), variables, ecode(:pagination))
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn
             |> query_error?(
               Schema.q(:paged_articles, :post),
               variables_0,
               ecode(:pagination)
             )

      assert guest_conn
             |> query_error?(
               Schema.q(:paged_articles, :post),
               variables_neg_1,
               ecode(:pagination)
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count
    end
  end

  describe "[query paged_posts filter sort]" do
    test "filter community should get posts which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      assert length(results["entries"]) == 3
      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(post.inner_id)))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      post = results["entries"] |> List.first()

      assert post["inserted_at"] == post["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work", ~m(guest_conn)a do
      most_views_post = Post |> order_by(desc: :views) |> limit(1) |> Repo.one()
      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      find_post = results |> Map.get("entries") |> hd

      # assert find_post["id"] == most_views_post |> Map.get(:id) |> to_string
      assert find_post["views"] == most_views_post |> Map.get(:views)
    end
  end

  describe "[query paged_posts filter has_xxx]" do
    test "has_xxx state should work", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      assert results["totalCount"] == 5

      the_post = Enum.find(results["entries"], &(&1["innerId"] == to_string(post.inner_id)))
      assert not the_post["viewerHasViewed"]
      assert not the_post["viewerHasUpvoted"]
      assert not the_post["viewerHasCollected"]
      assert not the_post["viewerHasReported"]

      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)
      {:ok, _} = CMS.Articles.upvote(post, user)
      {:ok, _} = CMS.Articles.collect(post, user)
      {:ok, post} = ORM.find(Post, post.id)
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)

      results = user_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      the_post = Enum.find(results["entries"], &(&1["innerId"] == to_string(post.inner_id)))

      assert the_post["viewerHasViewed"]
      assert the_post["viewerHasUpvoted"]
      assert the_post["viewerHasCollected"]
      assert the_post["viewerHasReported"]

      assert user_exist_in?(user, the_post["meta"]["latestUpvotedUsers"])
    end
  end

  # TODO test  sort, tag, community, when ...
  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_posts filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn post_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] != post_last_year.inner_id))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") == expect_count
    end

    test "THIS_WEEK option should work.", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      assert results |> Map.get("totalCount") == @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn post_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] != post_last_month.inner_id))
    end
  end

  describe "[paged posts active_at]" do
    test "latest commented post should appear on top",
         ~m(guest_conn community post_last_week user2)a do
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()
      assert first_post["innerId"] !== to_string(post_last_week.inner_id)

      Process.sleep(1500)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post_last_week.inner_id,
          mock_comment(),
          user2
        )

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      assert first_post["innerId"] == to_string(post_last_week.inner_id)
    end

    test "comment on very old post have no effect",
         ~m(guest_conn community post_last_year user2)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post_last_year.inner_id,
          mock_comment(),
          user2
        )

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      assert first_post["innerId"] !== to_string(post_last_year.inner_id)
    end

    test "latest post author commented post have no effect",
         ~m(guest_conn community post_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}
      {:ok, post} = ORM.find(Post, post_last_week.id, preload: [author: :user])

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post.inner_id,
          mock_comment(),
          post.author.user
        )

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      assert first_post["innerId"] !== to_string(post_last_week.inner_id)
    end
  end
end
