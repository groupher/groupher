defmodule GroupherServer.Test.Query.PagedArticles.PagedChangelogs do
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
    {community, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, changelog_last_week} = backdate(changelog, @last_week)

    {_, changelog, _, _} = mock_article(:changelog)

    {:ok, changelog_last_month} = backdate(changelog, @last_month)

    {community, changelog, _, user} = mock_article(:changelog, community, user)

    {:ok, changelog_last_year} = backdate(changelog, @last_year)

    Enum.each(1..@today_count, fn _index -> mock_article(:changelog) end)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 changelog_last_week changelog_last_month changelog_last_year community)a}
  end

  describe "[query paged_changelogs filter pagination]" do
    test "should get pagination info", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] >= @total_count
      assert results["entries"] |> List.first() |> Map.get("communityTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "PUBLISH"}}

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      first_changelog = results["entries"] |> List.first()
      assert first_changelog["innerId"] > article_inner_id(changelog, community)
    end

    test "upvotes_count order should work",
         ~m(guest_conn community changelog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "UPVOTES"}}

      {:ok, _} = CMS.Interactions.upvote(changelog_last_week, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(changelog_last_week, user2, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.upvote(changelog_last_week, user3, Ecto.UUID.generate())

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      first_changelog = results["entries"] |> List.first()

      assert first_changelog["innerId"] ===
               to_string(article_inner_id(changelog_last_week, community))
    end

    test "comments_count order should work",
         ~m(guest_conn community changelog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "COMMENTS"}}
      changelog_id = article_inner_id(changelog_last_week, community)

      {:ok, _} =
        CMS.Comments.create_comment(community, :changelog, changelog_id, mock_comment(), user, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Comments.create_comment(community, :changelog, changelog_id, mock_comment(), user2, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Comments.create_comment(community, :changelog, changelog_id, mock_comment(), user3, Ecto.UUID.generate())

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      first_changelog = results["entries"] |> List.first()

      assert first_changelog["innerId"] ===
               to_string(article_inner_id(changelog_last_week, community))
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "VIEWS"}}

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      track_view(changelog, user)
      track_view(changelog, user2)
      track_view(changelog, user3)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      first_changelog = results["entries"] |> List.first()
      assert first_changelog["innerId"] == to_string(article_inner_id(changelog, community))
    end

    test "should get valid article document", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      changelog = results["entries"] |> List.first()

      assert not is_nil(get_in(changelog, ["document", "html"]))
    end

    test "support community_tag filter", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :changelog, community_tag_attrs, user)

      {:ok, _} = CMS.Communities.set_tag(changelog, community_tag.id)

      variables = %{filter: %{page: 1, size: 10, community_tag: community_tag.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      variables = %{filter: %{page: 1, size: 10, community_tags: [community_tag.slug]}}
      results2 = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      assert results == results2

      changelog = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(%{id: to_string(community_tag.id)}, changelog["communityTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      changelog_attrs2 = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      changelog = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{slug: community.slug}, changelog["communities"])
    end

    test "returns cancan error when community changelog thread is disabled",
         ~m(guest_conn community)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :enable, %{
          changelog: false
        })

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :changelog),
               variables,
               ErrorCat.code(ArticleErrorCat.thread_not_visible())
             )
    end

    test "request large size fails", ~m(guest_conn)a do
      variables = %{filter: %{page: 1, size: 200}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :changelog),
               variables,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "request 0 or neg-size fails", ~m(guest_conn)a do
      variables_0 = %{filter: %{page: 1, size: 0}}
      variables_neg_1 = %{filter: %{page: 1, size: -1}}

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :changelog),
               variables_0,
               ErrorCat.code(WebErrorCat.pagination())
             )

      assert guest_conn
             |> query_error?(
               S.Article.q(:paged_articles, :changelog),
               variables_neg_1,
               ErrorCat.code(WebErrorCat.pagination())
             )
    end

    test "pagination should have default page and size arg", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] >= @total_count
    end
  end

  describe "[query paged_changelogs filter sort]" do
    test "filter community should get changelogs which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      assert length(results["entries"]) == 3

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] == to_string(article_inner_id(changelog, community))))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      changelog = results["entries"] |> List.first()

      assert changelog["inserted_at"] == changelog["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    test "filter sort MOST_VIEWS should work",
         ~m(guest_conn community changelog_last_year)a do
      Repo.update_all(
        from(summary in ArticleStats,
          where: summary.thread == :changelog and summary.article_id == ^changelog_last_year.id
        ),
        set: [views: 10, views_revision: 1, snapshot_at: DateTime.utc_now(:second)]
      )

      most_views_changelog =
        ArticleStats
        |> where([summary], summary.thread == :changelog)
        |> order_by(desc: :views)
        |> limit(1)
        |> Repo.one()

      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      find_changelog = results |> Map.get("entries") |> hd

      assert most_views_changelog.article_id == changelog_last_year.id

      assert find_changelog["innerId"] ==
               to_string(article_inner_id(changelog_last_year, community))
    end
  end

  describe "[query paged_changelogs private state boundary]" do
    test "public content never exposes viewer-private fields", ~m(user community)a do
      user_conn = simu_conn(:user, user)

      {:ok, changelog} = CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)
      {:ok, _} = CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)
      {:ok, _} = CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      assert results["totalCount"] == 5

      the_changelog =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(changelog, community)))
        )

      refute Map.has_key?(the_changelog, "viewerHasViewed")
      refute Map.has_key?(the_changelog, "viewerHasUpvoted")
      refute Map.has_key?(the_changelog, "viewerHasCollected")
      refute Map.has_key?(the_changelog, "viewerHasReported")

      track_view(changelog, user)

      {:ok, _} = CMS.Interactions.upvote(changelog, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Interactions.collect(changelog, user, Ecto.UUID.generate())
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)

      results = user_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      the_changelog =
        Enum.find(
          results["entries"],
          &(&1["innerId"] == to_string(article_inner_id(changelog, community)))
        )

      refute Map.has_key?(the_changelog, "viewerHasViewed")
      refute Map.has_key?(the_changelog, "viewerHasUpvoted")
      refute Map.has_key?(the_changelog, "viewerHasCollected")
      refute Map.has_key?(the_changelog, "viewerHasReported")

      assert user_exist_in?(user, the_changelog["meta"]["latestUpvotedUsers"])
    end
  end

  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_changelogs filter when]" do
    test "THIS_YEAR option should work", ~m(guest_conn community changelog_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      assert results["entries"]
             |> Enum.any?(
               &(&1["innerId"] != to_string(article_inner_id(changelog_last_year, community)))
             )
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") >= expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      assert results |> Map.get("totalCount") >= @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn community changelog_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      assert results["entries"]
             |> Enum.any?(&(&1["innerId"] != article_inner_id(changelog_last_month, community)))
    end
  end

  describe "[paged changelogs active_at]" do
    test "latest commented changelog should appear on top",
         ~m(guest_conn community changelog_last_week user2)a do
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      entries = results["entries"]
      first_changelog = entries |> List.first()
      refute matches_article?(first_changelog, community, changelog_last_week)

      Process.sleep(2000)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :changelog,
          article_inner_id(changelog_last_week, community),
          mock_comment(),
          user2, Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)

      entries = results["entries"]
      first_changelog = entries |> List.first()

      assert matches_article?(first_changelog, community, changelog_last_week)
    end

    test "comment on very old changelog have no effect",
         ~m(guest_conn community changelog_last_year user2)a do
      variables = %{filter: %{page: 1, size: 20}}

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :changelog,
          article_inner_id(changelog_last_year, community),
          mock_comment(),
          user2, Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      entries = results["entries"]
      first_changelog = entries |> List.first()

      refute matches_article?(first_changelog, community, changelog_last_year)
    end

    test "latest changelog author commented changelog have no effect",
         ~m(guest_conn community changelog_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}

      changelog =
        CMS.Model.Article |> Repo.get!(changelog_last_week.id) |> Repo.preload(author: :user)

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          :changelog,
          article_inner_id(changelog, community),
          mock_comment(),
          changelog.author.user, Ecto.UUID.generate()
        )

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :changelog), variables)
      entries = results["entries"]
      first_changelog = entries |> List.first()

      refute matches_article?(first_changelog, community, changelog_last_week)
    end
  end

  defp track_view(article, user) do
    assert {:ok, %{tracked: true}} =
             track_article_view(article, user, read_purpose: :public_read)
  end

  defp matches_article?(entry, community, article) do
    entry["innerId"] == to_string(article_inner_id(article, community)) and
      Enum.any?(entry["communities"], &(&1["slug"] == community.slug))
  end

  defp backdate(article, timestamp) do
    stable_article = Repo.get!(CMS.Model.Article, article.id)

    case stable_article
         |> Ecto.Changeset.change(%{inserted_at: timestamp, active_at: timestamp})
         |> Repo.update() do
      {:ok, _stable_article} ->
        {:ok, Map.merge(article, %{inserted_at: timestamp, active_at: timestamp})}

      error ->
        error
    end
  end
end
