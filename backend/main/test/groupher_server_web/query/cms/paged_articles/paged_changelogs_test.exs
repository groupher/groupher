defmodule GroupherServer.Test.Query.PagedArticles.PagedChangelogs do
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
    {community, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, changelog_last_week} =
      ORM.update(changelog, %{title: "last week", inserted_at: @last_week, active_at: @last_week},
        strict: false
      )

    {:ok, changelog_last_month} =
      db_insert(:changelog, %{title: "last month", inserted_at: @last_month})

    {community, changelog, _, user} = mock_article(:changelog, community, user)

    {:ok, changelog_last_year} =
      ORM.update(changelog, %{title: "last year", inserted_at: @last_year, active_at: @last_year},
        strict: false
      )

    db_insert_multi(:changelog, @today_count)

    guest_conn = simu_conn(:guest)

    {:ok,
     ~m(guest_conn user user2 user3 changelog_last_week changelog_last_month changelog_last_year community)a}
  end

  describe "[query paged_changelogs filter pagination]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
        entries {
          id
          title
          views
          upvotesCount
          commentsCount
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
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results |> is_valid_pagination?
      assert results["pageSize"] == 10
      assert results["totalCount"] == @total_count
      assert results["entries"] |> List.first() |> Map.get("articleTags") |> is_list
    end

    test "publish order should work", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 1, size: 20, order: "publish"}}

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      first_changelog = results["entries"] |> List.first()
      assert first_changelog["id"] > changelog.id
    end

    test "upvotes_count order should work",
         ~m(guest_conn changelog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "upvotes"}}

      {:ok, _} = CMS.upvote_article(:changelog, changelog_last_week.id, user)
      {:ok, _} = CMS.upvote_article(:changelog, changelog_last_week.id, user2)
      {:ok, _} = CMS.upvote_article(:changelog, changelog_last_week.id, user3)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      first_changelog = results["entries"] |> List.first()

      assert first_changelog["upvotesCount"] === 3
    end

    test "comments_count order should work",
         ~m(guest_conn community changelog_last_week user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "comments"}}
      changelog_id = changelog_last_week.inner_id

      {:ok, _} = CMS.create_comment(community, :changelog, changelog_id, mock_comment(), user)
      {:ok, _} = CMS.create_comment(community, :changelog, changelog_id, mock_comment(), user2)
      {:ok, _} = CMS.create_comment(community, :changelog, changelog_id, mock_comment(), user3)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      first_changelog = results["entries"] |> List.first()
      assert first_changelog["commentsCount"] === 3
    end

    test "views order should work", ~m(guest_conn community user user2 user3)a do
      variables = %{filter: %{page: 1, size: 20, order: "views"}}

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user2)

      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user3)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      first_changelog = results["entries"] |> List.first()
      last_changelog = results["entries"] |> List.last()
      assert first_changelog["views"] > last_changelog["views"]
    end

    test "should get valid thread document", ~m(guest_conn user community)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      Process.sleep(2000)
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)

      variables = %{filter: %{page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      changelog = results["entries"] |> List.first()

      assert not is_nil(get_in(changelog, ["document", "bodyHtml"]))
    end

    test "support article_tag filter", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)

      variables = %{filter: %{page: 1, size: 10, article_tag: article_tag.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      variables = %{filter: %{page: 1, size: 10, article_tags: [article_tag.slug]}}
      results2 = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      assert results == results2

      changelog = results["entries"] |> List.first()
      assert results["totalCount"] == 1
      assert exist_in?(article_tag, changelog["articleTags"])
    end

    test "support community filter", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)
      changelog_attrs2 = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs2, user)

      variables = %{filter: %{page: 1, size: 10, community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      changelog = results["entries"] |> List.first()
      assert results["totalCount"] == 4
      assert exist_in?(%{id: to_string(community.id)}, changelog["communities"])
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
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count
    end
  end

  describe "[query paged_changelogs filter sort]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
        entries {
          id
          insertedAt
          activeAt
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
    test "filter community should get changelogs which belongs to that community",
         ~m(guest_conn community user)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      # other 2 is in setup
      assert length(results["entries"]) == 3
      assert results["entries"] |> Enum.any?(&(&1["id"] == to_string(changelog.id)))
    end

    test "should have a active_at same with inserted_at", ~m(guest_conn community user)a do
      {:ok, _} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      changelog = results["entries"] |> List.first()

      assert changelog["inserted_at"] == changelog["active_at"]
    end

    test "filter sort should have default :desc_active", ~m(guest_conn)a do
      variables = %{filter: %{}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      active_timestamps = results["entries"] |> Enum.map(& &1["activeAt"])

      {:ok, first_inserted_time, 0} = active_timestamps |> List.first() |> DateTime.from_iso8601()
      {:ok, last_inserted_time, 0} = active_timestamps |> List.last() |> DateTime.from_iso8601()

      assert :gt = DateTime.compare(first_inserted_time, last_inserted_time)
    end

    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
        entries {
          id
          views
        }
      }
    }
    """
    test "filter sort MOST_VIEWS should work", ~m(guest_conn)a do
      most_views_changelog = Changelog |> order_by(desc: :views) |> limit(1) |> Repo.one()
      variables = %{filter: %{sort: "MOST_VIEWS"}}

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      find_changelog = results |> Map.get("entries") |> hd

      # assert find_changelog["id"] == most_views_changelog |> Map.get(:id) |> to_string
      assert find_changelog["views"] == most_views_changelog |> Map.get(:views)
    end
  end

  describe "[query paged_changelogs filter has_xxx]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
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
    test "has_xxx state should work", ~m(user community)a do
      user_conn = simu_conn(:user, user)
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
      {:ok, _} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
      {:ok, _} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      variables = %{filter: %{community: community.slug}}
      results = user_conn |> query_result(@query, variables, "pagedChangelogs")
      assert results["totalCount"] == 5

      the_changelog = Enum.find(results["entries"], &(&1["id"] == to_string(changelog.id)))
      assert not the_changelog["viewerHasViewed"]
      assert not the_changelog["viewerHasUpvoted"]
      assert not the_changelog["viewerHasCollected"]
      assert not the_changelog["viewerHasReported"]

      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      {:ok, _} = CMS.upvote_article(:changelog, changelog.id, user)
      {:ok, _} = CMS.collect_article(:changelog, changelog.id, user)
      {:ok, _} = CMS.report_article(:changelog, changelog.id, "reason", "attr_info", user)

      results = user_conn |> query_result(@query, variables, "pagedChangelogs")

      the_changelog = Enum.find(results["entries"], &(&1["id"] == to_string(changelog.id)))
      assert the_changelog["viewerHasViewed"]
      assert the_changelog["viewerHasUpvoted"]
      assert the_changelog["viewerHasCollected"]
      assert the_changelog["viewerHasReported"]

      assert user_exist_in?(user, the_changelog["meta"]["latestUpvotedUsers"])
    end
  end

  # TODO test  sort, tag, community, when ...
  @doc """
  test: FILTER when [TODAY] [THIS_WEEK] [THIS_MONTH] [THIS_YEAR]
  """
  describe "[query paged_changelogs filter when]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
        entries {
          id
          views
          insertedAt
        }
        totalCount
      }
    }
    """
    test "THIS_YEAR option should work", ~m(guest_conn changelog_last_year)a do
      variables = %{filter: %{when: "THIS_YEAR"}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results["entries"] |> Enum.any?(&(&1["id"] != changelog_last_year.id))
    end

    test "TODAY option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "TODAY"}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      expect_count = @total_count - @last_year_count - @last_month_count - @last_week_count

      assert results |> Map.get("totalCount") == expect_count
    end

    test "THIS_WEEK option should work", ~m(guest_conn)a do
      variables = %{filter: %{when: "THIS_WEEK"}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results |> Map.get("totalCount") == @today_count
    end

    test "THIS_MONTH option should work", ~m(guest_conn changelog_last_month)a do
      variables = %{filter: %{when: "THIS_MONTH"}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results["entries"] |> Enum.any?(&(&1["id"] != changelog_last_month.id))
    end
  end

  describe "[paged changelogs active_at]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
        entries {
          id
          insertedAt
          activeAt
        }
      }
    }
    """
    test "latest commented changelog should appear on top",
         ~m(guest_conn community changelog_last_week user2)a do
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      entries = results["entries"]
      first_changelog = entries |> List.first()
      assert first_changelog["id"] !== to_string(changelog_last_week.id)

      Process.sleep(1500)

      {:ok, _} =
        CMS.create_comment(
          community,
          :changelog,
          changelog_last_week.inner_id,
          mock_comment(),
          user2
        )

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      entries = results["entries"]
      first_changelog = entries |> List.first()

      assert first_changelog["id"] == to_string(changelog_last_week.id)
    end

    test "comment on very old changelog have no effect",
         ~m(guest_conn community changelog_last_year user2)a do
      variables = %{filter: %{page: 1, size: 20}}

      changelog_id = changelog_last_year.inner_id

      {:ok, _} =
        CMS.create_comment(community, :changelog, changelog_id, mock_comment(), user2)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      entries = results["entries"]
      first_changelog = entries |> List.first()

      assert first_changelog["id"] !== to_string(changelog_last_year.id)
    end

    test "latest changelog author commented changelog have no effect",
         ~m(guest_conn community changelog_last_week)a do
      variables = %{filter: %{page: 1, size: 20}}
      {:ok, changelog} = ORM.find(Changelog, changelog_last_week.id, preload: [author: :user])

      changelog_id = changelog.inner_id

      {:ok, _} =
        CMS.create_comment(
          community,
          :changelog,
          changelog_id,
          mock_comment(),
          changelog.author.user
        )

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      entries = results["entries"]
      first_changelog = entries |> List.first()

      assert first_changelog["id"] !== to_string(changelog_last_week.id)
    end
  end
end
