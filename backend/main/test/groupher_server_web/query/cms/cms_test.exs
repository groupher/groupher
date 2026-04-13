defmodule GroupherServer.Test.Query.CMS.Basic do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.Category

  defp create_community!(user, attrs \\ %{}) do
    community_attrs = mock_attrs(:community, attrs)
    {:ok, community} = CMS.Communities.create(community_attrs, user)
    community
  end

  defp create_communities!(count, user) do
    Enum.map(1..count, fn _ ->
      create_community!(user)
    end)
  end

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    {:ok, ~m(guest_conn community user user2)a}
  end

  describe "apply community" do
    @check_community_pending_query """
    query {
      hasPendingCommunityApply {
        exist
      }
    }
    """
    test "can check if user has pending apply", ~m(user)a do
      user_conn = simu_conn(:user, user)

      check_state = user_conn |> gq_query(@check_community_pending_query)

      assert not check_state["exist"]

      attrs = mock_attrs(:community)
      {:ok, _community} = CMS.Communities.apply(attrs, user)

      user_conn = simu_conn(:user, user)
      check_state = user_conn |> gq_query(@check_community_pending_query)

      assert check_state["exist"]
    end

    @check_community_exist_query """
    query($slug: String!) {
      isCommunityExist(slug: $slug) {
        exist
      }
    }
    """
    test "can check if a community is exist", ~m(user)a do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})

      check_state = rule_conn |> gq_query(@check_community_exist_query, %{slug: "elixir"})

      assert not check_state["exist"]

      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, _community} = CMS.Communities.create(community_attrs, user)

      check_state = rule_conn |> gq_query(@check_community_exist_query, %{slug: "elixir"})
      assert check_state["exist"]
    end
  end

  describe "[cms communities]" do
    @query """
    query($slug: String!, $incViews: Boolean) {
      community(slug: $slug, incViews: $incViews) {
        id
        title
        threadsCount
        communityTagsCount
        views
        dashboard {
          layout {
            kanbanBoards
          }
        }
        threads {
          id
          slug
          index
        }
      }
    }
    """
    test "views should work", ~m(guest_conn user)a do
      community = create_community!(user)

      variables = %{slug: community.slug}
      guest_conn |> gq_query(@query, variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.views == 1
      guest_conn |> gq_query(@query, variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.views == 2
    end

    test "views should work with inc_views as false", ~m(guest_conn user)a do
      community = create_community!(user)

      variables = %{slug: community.slug, incViews: false}
      guest_conn |> gq_query(@query, variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.views == 0
      guest_conn |> gq_query(@query, variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.views == 0
    end

    test "can get from alias community name", ~m(guest_conn user)a do
      _community = create_community!(user, %{slug: "kubernetes", aka: "k8s"})

      variables = %{slug: "k8s"}
      aka_results = guest_conn |> gq_query(@query, variables)

      variables = %{slug: "kubernetes"}
      results = guest_conn |> gq_query(@query, variables)

      assert results["id"] == aka_results["id"]
    end

    test "community query exposes default kanban boards", ~m(guest_conn user)a do
      community = create_community!(user)

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert get_in(results, ["dashboard", "layout", "kanbanBoards"]) == ["todo", "wip", "done"]
    end

    test "can get threads count (default include)", ~m(community guest_conn)a do
      {:ok, threads} = db_insert_multi(:thread, 5)

      Enum.map(threads, fn thread ->
        CMS.Communities.set_thread(community, thread)
      end)

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert results["threadsCount"] == 10
    end

    test "can get tags count ", ~m(community guest_conn user)a do
      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, _community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, _community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert results["communityTagsCount"] == 2
    end

    test "guest use get community threads with default asc sort index",
         ~m(guest_conn community)a do
      {:ok, threads} = db_insert_multi(:thread, 5)

      Enum.map(threads, fn thread ->
        CMS.Communities.set_thread(community, thread)
      end)

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      first_idx = results["threads"] |> List.first() |> Map.get("index")
      last_idx = results["threads"] |> List.last() |> Map.get("index")

      assert first_idx < last_idx
    end

    @query """
    query($filter: CommunitiesFilter!) {
      pagedCommunities(filter: $filter) {
        entries {
          id
          title
          index
          viewerHasSubscribed
          categories {
            id
            title
            slug
          }
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "user can get viewer has subscribed state", ~m(user)a do
      communities = create_communities!(5, user)
      {:ok, _record} = CMS.Communities.subscribe(communities |> List.first(), user)

      variables = %{filter: %{page: 1, size: 20}}
      user_conn = simu_conn(:user, user)
      results = user_conn |> gq_query(@query, variables)

      assert results["entries"] |> Enum.any?(&(&1["viewerHasSubscribed"] == true))
    end

    test "guest user can get paged communities", ~m(guest_conn user)a do
      _communities = create_communities!(5, user)

      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      # 1 is for setup community
      assert results["totalCount"] == 5 + 1
    end

    test "community has default index = 100000", ~m(guest_conn user)a do
      _communities = create_communities!(5, user)
      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)

      assert Enum.all?(results["entries"], fn x -> x["index"] == 100_000 end)
    end

    test "guest user can get paged communities based on category", ~m(guest_conn user)a do
      {:ok, category1} = db_insert(:category)
      {:ok, category2} = db_insert(:category)

      communities = create_communities!(10, user)

      community1 = communities |> Enum.at(0)
      community2 = communities |> Enum.at(1)
      communityn = communities |> List.last()
      # [community1, community2, _] = communities

      CMS.Communities.set_category(%Community{id: community1.id}, %Category{id: category1.id})
      CMS.Communities.set_category(%Community{id: community2.id}, %Category{id: category2.id})
      CMS.Communities.set_category(%Community{id: communityn.id}, %Category{id: category2.id})

      variables = %{filter: %{page: 1, size: 20, category: category1.slug}}
      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"]
             |> List.first()
             |> Map.get("categories")
             |> Enum.any?(&(&1["id"] == to_string(category1.id)))

      assert results["totalCount"] == 1

      variables = %{filter: %{page: 1, size: 20, category: category2.slug}}
      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 2

      assert results["entries"]
             |> List.first()
             |> Map.get("categories")
             |> Enum.any?(&(&1["id"] == to_string(category2.id)))

      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 10 + 1
    end
  end

  describe "[cms threads]" do
    @query """
    query($filter: ThreadsFilter!) {
      pagedThreads(filter: $filter) {
        entries {
          id
          title
          slug
          index
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "can get whole threads (with default)", ~m(guest_conn)a do
      {:ok, _threads} = db_insert_multi(:thread, 5)

      variables = %{filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(@query, variables)
      assert results |> is_valid_pagination?
      assert results["totalCount"] == 10
    end

    test "can get sorted thread based on index", ~m(guest_conn)a do
      {:ok, _threads} = db_insert_multi(:thread, 10)

      variables = %{filter: %{page: 1, size: 20, sort: "DESC_INDEX"}}
      results = guest_conn |> gq_query(@query, variables)
      first_idx = results["entries"] |> List.first() |> Map.get("index")
      last_idx = results["entries"] |> List.last() |> Map.get("index")

      assert first_idx > last_idx

      variables = %{filter: %{page: 1, size: 20, sort: "ASC_INDEX"}}
      results = guest_conn |> gq_query(@query, variables)
      first_idx = results["entries"] |> List.first() |> Map.get("index")
      last_idx = results["entries"] |> List.last() |> Map.get("index")

      assert first_idx < last_idx
    end
  end

  describe "[cms query categories]" do
    @query """
    query($filter: PagiFilter!) {
      pagedCategories(filter: $filter) {
        entries {
          id
          title
          author {
            id
            nickname
          }
          communities {
            id
            title
          }
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "guest user can get paged categories", ~m(guest_conn user)a do
      variables = %{filter: %{page: 1, size: 10}}
      valid_attrs = mock_attrs(:category)
      ~m(title slug)a = valid_attrs

      {:ok, _} = CMS.Communities.create_category(~m(title slug)a, %User{id: user.id})

      results = guest_conn |> gq_query(@query, variables)
      author = results["entries"] |> List.first() |> Map.get("author")

      assert results |> is_valid_pagination?
      assert author["id"] == to_string(user.id)
    end

    test "paged categories containes communities info", ~m(guest_conn user community)a do
      variables = %{filter: %{page: 1, size: 10}}
      valid_attrs = mock_attrs(:category)
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.Communities.create_category(~m(title slug)a, %User{id: user.id})

      {:ok, _} =
        CMS.Communities.set_category(%Community{id: community.id}, %Category{id: category.id})

      results = guest_conn |> gq_query(@query, variables)
      contain_communities = results["entries"] |> List.first() |> Map.get("communities")

      assert contain_communities |> List.first() |> Map.get("id") == to_string(community.id)
    end
  end

  describe "[cms query community]" do
    @query """
    query($slug: String!) {
      community(slug: $slug, title: $title) {
        id
        title
        desc
      }
    }
    """
    test "guest user can get community info without args fails", ~m(guest_conn)a do
      variables = %{}
      assert guest_conn |> query_error?(@query, variables)
    end

    @query """
    query($slug: String!) {
      community(slug: $slug) {
        id
        title
        desc
        dashboard {
          seo {
            ogTitle
            ogDescription
          }
          layout {
            postLayout
            kanbanBgColors
            topbarEnabled
          }
          baseInfo {
            favicon
          }

          rss {
            rssFeedType
            rssFeedCount
          }

          nameAlias {
            slug
            name
          }
        }
      }
    }
    """
    test "user can get community info without args fails", ~m(guest_conn user)a do
      community_attrs = mock_attrs(:community)

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, _} = CMS.Communities.update_dashboard(community, :seo, %{og_title: "groupher"})

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :layout, %{
          post_layout: "cover",
          topbar_enabled: true
        })

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :layout, %{kanban_bg_colors: ["GREEN", "RED"]})

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :base_info, %{favicon: "new favicon"})

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :rss, %{
          rss_feed_type: "digest",
          rss_feed_count: 50
        })

      {:ok, _} =
        CMS.Communities.update_dashboard(community, :name_alias, [
          %{slug: "slug 0", name: "name 0"}
        ])

      variables = %{slug: community.slug}

      results = guest_conn |> gq_query(@query, variables)
      assert get_in(results, ["dashboard", "seo", "ogTitle"]) == "groupher"
      assert get_in(results, ["dashboard", "layout", "postLayout"]) == "cover"
      assert get_in(results, ["dashboard", "layout", "topbarEnabled"]) == true
      assert get_in(results, ["dashboard", "layout", "kanbanBgColors"]) == ["GREEN", "RED"]
      assert get_in(results, ["dashboard", "baseInfo", "favicon"]) == "new favicon"

      assert get_in(results, ["dashboard", "rss", "rssFeedType"]) == "digest"
      assert get_in(results, ["dashboard", "rss", "rssFeedCount"]) == 50

      assert get_in(results, ["dashboard", "nameAlias"]) == [
               %{"name" => "name 0", "slug" => "slug 0"}
             ]
    end
  end

  describe "[cms community moderators]" do
    @query """
    query($slug: String!) {
      community(slug: $slug) {
        id
        moderatorsCount
      }
    }
    """
    test "guest can get moderators count of a community", ~m(guest_conn community user)a do
      role = "moderator"
      {:ok, users} = db_insert_multi(:user, assert_v(:inner_page_size))
      cur_user = user

      Enum.each(users, &CMS.Communities.add_moderator(community, role, &1, cur_user))

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)
      moderators_count = results["moderatorsCount"]

      assert results["id"] == to_string(community.id)
      assert moderators_count == assert_v(:inner_page_size) + 1
    end

    @query """
    query($id: ID!, $filter: PagiFilter!) {
      pagedCommunityModerators(id: $id, filter: $filter) {
        entries {
          nickname
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "guest user can get paged moderators", ~m(guest_conn user community)a do
      role = "moderator"
      {:ok, users} = db_insert_multi(:user, 25)

      cur_user = user

      Enum.each(
        users,
        &CMS.Communities.add_moderator(community, role, %User{id: &1.id}, cur_user)
      )

      variables = %{id: community.id, filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
    end
  end

  describe "[cms community subscribe]" do
    @query """
    query($slug: String!) {
      community(slug: $slug) {
        id
        subscribersCount
      }
    }
    """
    test "guest can get subscribers count of a community", ~m(guest_conn community)a do
      {:ok, users} = db_insert_multi(:user, assert_v(:inner_page_size))

      Enum.each(users, &CMS.Communities.subscribe(community, %User{id: &1.id}))

      variables = %{slug: community.slug}
      results = guest_conn |> gq_query(@query, variables)
      subscribers_count = results["subscribersCount"]

      assert subscribers_count == assert_v(:inner_page_size)
    end

    @query """
    query($id: ID, $community: String, $filter: PagiFilter!) {
      pagedCommunitySubscribers(id: $id, community: $community, filter: $filter) {
        entries {
          id
          nickname
          avatar
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "guest user can get paged subscribers by community id", ~m(guest_conn community)a do
      {:ok, users} = db_insert_multi(:user, 25)

      Enum.each(
        users,
        &CMS.Communities.subscribe(community, %User{id: &1.id})
      )

      variables = %{id: community.id, filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
    end

    test "guest user can get paged subscribers by community slug", ~m(guest_conn community)a do
      {:ok, users} = db_insert_multi(:user, 25)

      Enum.each(
        users,
        &CMS.Communities.subscribe(community, %User{id: &1.id})
      )

      variables = %{community: community.slug, filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
    end

    @query """
    query($url: String!) {
      openGraphInfo(url: $url) {
        title
        favicon
        url
        siteName
      }
    }
    """
    @tag :skip_ci
    test "can get open-graph info by url", ~m(user)a do
      user_conn = simu_conn(:user, user)

      user_conn
      |> gq_query(@check_community_pending_query)

      variables = %{url: "https://www.ifanr.com/1561465"}

      results = user_conn |> gq_query(@query, variables)

      assert not is_nil(results["title"])
      assert not is_nil(results["favicon"])
      assert not is_nil(results["siteName"])
    end
  end
end
