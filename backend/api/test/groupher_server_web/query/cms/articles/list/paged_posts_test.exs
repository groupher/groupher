defmodule GroupherServer.Test.Query.PagedArticles.PagedPosts do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Model.ArticleStats
  alias GroupherServer.CMS

  @article_cat CMS.Artiment.Const.cat_map()
  @article_status CMS.Artiment.Const.status_map()

  @page_size Helper.ORM.Pagi.Config.default().default_size

  @today_count 3
  @last_week_count 1
  @last_month_count 1
  @last_year_count 1

  @total_count @today_count + @last_week_count + @last_month_count + @last_year_count

  setup do
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {community, post, _, user} = mock_article(:post)

    {:ok, post_last_week} = backdate(post, @last_week)

    {last_month_community, post, _, _} = mock_article(:post)

    {:ok, post_last_month} = backdate(post, @last_month)

    {_, post, _, _} = mock_article(:post, community, user)

    {:ok, post_last_year} = backdate(post, @last_year)

    Enum.each(1..@today_count, fn _index -> mock_article(:post) end)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 post_last_week post_last_month post_last_year community last_month_community)a}
  end

  describe "[query paged_posts filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{pagi: %{offset: %{page: 1, size: 10}}, filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      assert results |> is_valid_pagination?
      assert results["pageInfo"]["size"] == 10
      assert results["pageInfo"]["totalCount"] >= @total_count
      assert results["entries"] |> List.first() |> Map.get("communityTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{order: "PUBLISH"}}

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()
      assert first_post["innerId"] == to_string(article_inner_id(post, community))
    end

    test "upvotes_count order should work",
         ~m(guest_conn community post_last_week user user2 user3)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{order: "UPVOTES"}}

      {:ok, _} = CMS.Interactions.upvote(post_last_week, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(post_last_week, user2, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(post_last_week, user3, Ecto.UUID.generate())

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()

      assert first_post["innerId"] === to_string(article_inner_id(post_last_week, community))
    end

    test "comments_count order should work",
         ~m(guest_conn community post_last_week user user2 user3)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{order: "COMMENTS"}}
      post_id = article_inner_id(post_last_week, community)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post_id,
          mock_comment(),
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post_id,
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          post_id,
          mock_comment(),
          user3,
          Ecto.UUID.generate()
        )

      results =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post, "cat status"), variables)

      first_post = results["entries"] |> List.first()
      assert first_post["innerId"] === to_string(article_inner_id(post_last_week, community))
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{order: "VIEWS"}}

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      track_view(post, user)
      track_view(post, user2)
      track_view(post, user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      first_post = results["entries"] |> List.first()
      assert first_post["innerId"] == to_string(article_inner_id(post, community))
    end

    test "should get valid cat & status", ~m(guest_conn community post_last_week user)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{}}

      {:ok, _} = CMS.Articles.set_cat(post_last_week.id, @article_cat.idea, user, community.id)

      {:ok, _} =
        CMS.Articles.set_status(post_last_week.id, @article_status.wip, user, community.id)

      results =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post, "cat status"), variables)

      assert results["entries"] |> Enum.any?(&(&1["cat"] == "IDEA"))
      assert results["entries"] |> Enum.any?(&(&1["status"] == "WIP"))
    end

    test "explicit null filters behave like omitted filters", ~m(guest_conn)a do
      omitted = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{}}

      explicit_nulls = %{
        pagi: %{offset: %{page: 1, size: 20}},
        filter: %{cat: nil, status: nil, order: nil, when: nil, sort: nil}
      }

      omitted_result = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), omitted)

      explicit_nulls_result =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post), explicit_nulls)

      assert explicit_nulls_result == omitted_result
    end

    test "should get valid cat & status by filter",
         ~m(guest_conn community post_last_week user)a do
      {:ok, _} = CMS.Articles.set_cat(post_last_week.id, @article_cat.idea, user, community.id)

      {:ok, _} =
        CMS.Articles.set_status(post_last_week.id, @article_status.wip, user, community.id)

      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{cat: "IDEA"}}

      results =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post, "cat status"), variables)

      assert results["pageInfo"]["totalCount"] == 1

      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{cat: "NOT_EXIST"}}

      assert guest_conn
             |> query_error?(S.Article.q(:paged_articles, :post, "cat status"), variables)

      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{status: "WIP"}}

      results =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post, "cat status"), variables)

      assert results["pageInfo"]["totalCount"] == 1

      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{status: "NOT_EXIST"}}

      assert guest_conn
             |> query_error?(S.Article.q(:paged_articles, :post, "cat status"), variables)

      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{cat: "IDEA", status: "WIP"}}

      results =
        guest_conn |> gq_query(S.Article.q(:paged_articles, :post, "cat status"), variables)

      assert results["pageInfo"]["totalCount"] == 1
    end

    test "should get valid article document", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)

      variables = %{pagi: %{offset: %{page: 1, size: 10}}, filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      post = results["entries"] |> List.first()

      assert not Map.has_key?(post, "body")
    end

    test "support article_tag filter", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      article_tag_attrs = mock_attrs(:community_tag)

      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} = CMS.Communities.set_tag(post, article_tag.id, user, Ecto.UUID.generate())

      variables = %{
        pagi: %{offset: %{page: 1, size: 10}},
        filter: %{community_tag: article_tag.slug}
      }

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      variables = %{
        pagi: %{offset: %{page: 1, size: 10}},
        filter: %{community_tags: [article_tag.slug]}
      }

      results2 = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      assert results == results2

      post = results["entries"] |> List.first()
      assert results["pageInfo"]["totalCount"] == 1
      assert exist_in?(%{id: to_string(article_tag.id)}, post["communityTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)
      post_attrs2 = mock_attrs(:post, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs2, user)

      variables = %{
        pagi: %{offset: %{page: 1, size: 10, config_revision: 0}},
        filter: %{community: community.slug}
      }

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      post = results["entries"] |> List.first()
      assert results["pageInfo"]["totalCount"] == 4
      assert post["community"]["slug"] == community.slug
    end

    test "returns cancan error when community post thread is disabled",
         ~m(guest_conn community user)a do
      {:ok, _} =
        CMS.Dashboard.update(
          community,
          :enable,
          %{
            post: false
          },
          user,
          Ecto.UUID.generate()
        )

      variables = %{
        pagi: %{offset: %{page: 1, size: 10, config_revision: 0}},
        filter: %{community: community.slug}
      }

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :post),
               variables,
               ErrorCat.code(ArticleErrorCat.thread_not_visible())
             )
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{pagi: %{offset: %{page: 1, size: 200}}, filter: %{}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :post),
               variables,
               ErrorCat.code(GroupherServer.Pagi.ErrorCat.size_out_of_range())
             )
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{pagi: %{offset: %{page: 1, size: 0}}, filter: %{}}
      variables_neg_1 = %{pagi: %{offset: %{page: 1, size: -1}}, filter: %{}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :post),
               variables_0,
               ErrorCat.code(GroupherServer.Pagi.ErrorCat.size_out_of_range())
             )

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :post),
               variables_neg_1,
               ErrorCat.code(GroupherServer.Pagi.ErrorCat.size_out_of_range())
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      assert results |> is_valid_pagination?
      assert results["pageInfo"]["size"] == @page_size
      assert results["pageInfo"]["totalCount"] >= @total_count
    end
  end

  describe "[query paged_posts filter sort]" do
    test "filter community should get posts which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      assert length(results["entries"]) == 3

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] == to_string(article_inner_id(post, community))))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      post = results["entries"] |> List.first()

      assert post["inserted_at"] == post["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work", ~m(guest_conn community post_last_year)a do
      Repo.update_all(
        from(summary in ArticleStats,
          where: summary.thread == :post and summary.article_id == ^post_last_year.id
        ),
        set: [views: 10, views_revision: 1, snapshot_at: DateTime.utc_now(:second)]
      )

      most_views_post =
        ArticleStats
        |> where([summary], summary.thread == :post)
        |> order_by(desc: :views)
        |> limit(1)
        |> Repo.one()

      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      find_post = results |> Map.get("entries") |> hd

      assert most_views_post.article_id == post_last_year.id
      assert find_post["innerId"] == to_string(article_inner_id(post_last_year, community))
    end

    test "filter sort LEAST_VIEWS should use Summary zero-row semantics",
         ~m(guest_conn community post_last_year)a do
      Repo.update_all(
        from(summary in ArticleStats,
          where: summary.thread == :post and summary.article_id == ^post_last_year.id
        ),
        set: [views: 10, views_revision: 1, snapshot_at: DateTime.utc_now(:second)]
      )

      variables = %{filter: %{community: community.slug, sort: "LEAST_VIEWS"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      find_post = results |> Map.get("entries") |> hd

      refute find_post["innerId"] == to_string(article_inner_id(post_last_year, community))
    end
  end

  describe "[query paged_posts private state boundary]" do
    test "public content never exposes viewer-private fields", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:ok, _} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      assert results["pageInfo"]["totalCount"] == 5

      the_post =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(post, community)))
        )

      refute Map.has_key?(the_post, "viewerHasViewed")
      refute Map.has_key?(the_post, "viewerHasUpvoted")
      refute Map.has_key?(the_post, "viewerHasCollected")

      track_view(post, user)

      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.collect(post, user, Ecto.UUID.generate())

      results = user_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      the_post =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(post, community)))
        )

      refute Map.has_key?(the_post, "viewerHasViewed")
      refute Map.has_key?(the_post, "viewerHasUpvoted")
      refute Map.has_key?(the_post, "viewerHasCollected")

      refute Map.has_key?(the_post, "meta")
    end
  end

  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_posts filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn community post_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] != article_inner_id(post_last_year, community)))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results["pageInfo"]["totalCount"] >= expect_count
    end

    test "THIS_WEEK option should work.", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      assert results["pageInfo"]["totalCount"] >= @today_count
    end

    test "THIS_MONTH option should work",
         ~m(guest_conn last_month_community post_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)

      assert results["entries"]
             |> Enum.any?(
               &(&1["innerId"] != article_inner_id(post_last_month, last_month_community))
             )
    end
  end

  describe "[paged posts active_at]" do
    test "latest commented post should appear on top",
         ~m(guest_conn community post_last_week user2)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()
      refute matches_article?(first_post, community, post_last_week)

      Process.sleep(1500)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post_last_week, community),
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      assert matches_article?(first_post, community, post_last_week)
    end

    test "comment on very old post have no effect",
         ~m(guest_conn community post_last_year user2)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{}}

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post_last_year, community),
          mock_comment(),
          user2,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      refute matches_article?(first_post, community, post_last_year)
    end

    test "latest post author commented post have no effect",
         ~m(guest_conn community post_last_week)a do
      variables = %{pagi: %{offset: %{page: 1, size: 20}}, filter: %{}}
      post = CMS.Model.Article |> Repo.get!(post_last_week.id) |> Repo.preload(author: :user)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_comment(),
          post.author.user,
          Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :post), variables)
      entries = results["entries"]
      first_post = entries |> List.first()

      refute matches_article?(first_post, community, post_last_week)
    end
  end

  defp track_view(article, user) do
    assert {:ok, %{tracked: true}} =
             track_article_view(article, user, read_purpose: :public_read)
  end

  defp matches_article?(entry, community, article) do
    entry["innerId"] == to_string(article_inner_id(article, community)) and
      entry["community"]["slug"] == community.slug
  end

  defp backdate(article, timestamp) do
    stored = Repo.get!(CMS.Model.Article, article.id)

    with {:ok, updated} <-
           stored
           |> Ecto.Changeset.change(%{inserted_at: timestamp, active_at: timestamp})
           |> Repo.update() do
      {:ok,
       Map.merge(article, %{
         inserted_at: updated.inserted_at,
         active_at: updated.active_at
       })}
    end
  end
end
