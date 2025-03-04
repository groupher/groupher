defmodule GroupherServer.Test.Mutation.CMS.CRUD do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Category, Community, CommunityModerator, Passport}

  alias Helper.{ORM, Constant}

  @community_normal Constant.CMS.pending(:normal)
  @community_applying Constant.CMS.pending(:applying)

  # @default_root_rules Certification.passport_rules(cms: "root")

  setup do
    {:ok, category} = db_insert(:category)
    {:ok, thread} = db_insert(:thread)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
    {:ok, community} = CMS.create_community(community_attrs)

    user_conn = simu_conn(:user)
    user_conn2 = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn user_conn2 guest_conn community thread category user user2)a}
  end

  describe "mutation cms category" do
    @create_category_query """
    mutation($title: String!, $slug: String!) {
      createCategory(title: $title, slug: $slug) {
        id
        title
        author {
          id
          nickname
          avatar
        }
      }
    }
    """
    test "auth user can create category", ~m(user)a do
      variables = mock_attrs(:category, %{user_id: user.id})
      rule_conn = simu_conn(:user, cms: %{"category.create" => true})

      created = rule_conn |> mutation_result(@create_category_query, variables, "createCategory")
      # author = created["author"]
      assert created["title"] == variables.title
    end

    @delete_category_query """
    mutation($id: ID!) {
      deleteCategory(id: $id) {
        id
      }
    }
    """
    test "auth user can delete category" do
      {:ok, category} = db_insert(:category)
      rule_conn = simu_conn(:user, cms: %{"category.delete" => true})

      variables = %{id: category.id}
      deleted = rule_conn |> mutation_result(@delete_category_query, variables, "deleteCategory")

      assert deleted["id"] == to_string(category.id)
    end

    @update_category_query """
    mutation($id: ID!, $title: String!) {
      updateCategory(id: $id, title: $title) {
        id
        title
      }
    }
    """
    test "auth user can update  category", ~m(category)a do
      rule_conn = simu_conn(:user, cms: %{"category.update" => true})
      variables = %{id: category.id, title: "new title"}

      updated = rule_conn |> mutation_result(@update_category_query, variables, "updateCategory")
      assert updated["title"] == "new title"
    end

    test "unauth user create category fails", ~m(user user_conn guest_conn)a do
      variables = mock_attrs(:category, %{user_id: user.id})
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@create_category_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@create_category_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@create_category_query, variables, ecode(:passport))
    end

    test "unauth user update category fails", ~m(category user_conn guest_conn)a do
      variables = %{id: category.id, title: "new title"}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@update_category_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@update_category_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@update_category_query, variables, ecode(:passport))
    end

    @set_category_query """
    mutation($categoryId: ID! $communityId: ID!) {
      setCategory(categoryId: $categoryId, communityId: $communityId) {
        id
        title

        categories {
          id
          title
        }
      }
    }
    """
    test "auth user can set a category to a community" do
      {:ok, community} = db_insert(:community)
      {:ok, category} = db_insert(:category)

      rule_conn = simu_conn(:user, cms: %{"category.set" => true})
      variables = %{communityId: community.id, categoryId: category.id}

      rule_conn |> mutation_result(@set_category_query, variables, "setCategory")

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categroies = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id in assoc_categroies
      assert community.id in assoc_communities
    end

    @unset_category_query """
    mutation($categoryId: ID! $communityId: ID!) {
      unsetCategory(categoryId: $categoryId, communityId: $communityId) {
        id
        title
      }
    }
    """
    test "auth user can unset a category to a community" do
      {:ok, community} = db_insert(:community)
      {:ok, category} = db_insert(:category)

      {:ok, _} = CMS.set_category(%Community{id: community.id}, %Category{id: category.id})

      rule_conn = simu_conn(:user, cms: %{"category.unset" => true})
      variables = %{communityId: community.id, categoryId: category.id}

      rule_conn |> mutation_result(@unset_category_query, variables, "setCategory")

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categroies = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id not in assoc_categroies
      assert community.id not in assoc_communities
    end

    test "unauth user set/unset category fails", ~m(user_conn guest_conn)a do
      {:ok, community} = db_insert(:community)
      {:ok, category} = db_insert(:category)

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})
      variables = %{communityId: community.id, categoryId: category.id}

      assert user_conn |> mutation_get_error?(@set_category_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@set_category_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@set_category_query, variables, ecode(:passport))

      assert user_conn |> mutation_get_error?(@unset_category_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@unset_category_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@unset_category_query, variables, ecode(:passport))
    end
  end

  describe "[mutation cms community]" do
    @create_community_query """
    mutation($title: String!, $desc: String!, $logo: String!, $slug: String!, $locale: String) {
      createCommunity(title: $title, desc: $desc, logo: $logo, slug: $slug, locale: $locale) {
        id
        title
        desc
        locale
        author {
          id
        }
        threads {
          title
          slug
          index
        }
      }
    }
    """
    test "create community with valid attrs" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = mock_attrs(:community, %{locale: "zh"})

      created =
        rule_conn |> mutation_result(@create_community_query, variables, "createCommunity")

      {:ok, found} = Community |> ORM.find(created["id"])
      assert created["id"] == to_string(found.id)
      assert created["locale"] == "zh"
    end

    test "created community should have default threads" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = mock_attrs(:community)

      created =
        rule_conn |> mutation_result(@create_community_query, variables, "createCommunity")

      assert created["threads"] == [
               %{"index" => 0, "slug" => "post", "title" => "post"},
               %{"index" => 1, "slug" => "kanban", "title" => "kanban"},
               %{"index" => 2, "slug" => "changelog", "title" => "changelog"},
               %{"index" => 3, "slug" => "doc", "title" => "doc"},
               %{"index" => 4, "slug" => "about", "title" => "about"}
             ]
    end

    test "can create community with some title, different slug" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = mock_attrs(:community, %{title: "elixir", slug: "elixir1"})
      rule_conn |> mutation_result(@create_community_query, variables, "createCommunity")
      variables = mock_attrs(:community, %{title: "elixir", slug: "elixir2"})
      rule_conn |> mutation_result(@create_community_query, variables, "createCommunity")

      {:ok, community} = Community |> ORM.find_by(%{slug: "elixir1"})
      assert community.title == "elixir"

      {:ok, community} = Community |> ORM.find_by(%{slug: "elixir2"})
      assert community.title == "elixir"
    end

    test "can not create community with some slug" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = mock_attrs(:community, %{title: "elixir1", slug: "elixir"})

      first =
        rule_conn
        |> mutation_result(@create_community_query, variables, "createCommunity")

      assert not is_nil(first)

      variables = mock_attrs(:community, %{title: "elixir2", slug: "elixir"})

      last =
        rule_conn
        |> mutation_result(@create_community_query, variables, "createCommunity")

      assert is_nil(last)
    end

    @update_community_query """
    mutation($id: ID!, $title: String, $desc: String, $logo: String) {
      updateCommunity(id: $id, title: $title, desc: $desc, logo: $logo) {
        id
        title
        desc
      }
    }
    """

    test "update community with valid attrs", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})
      variables = %{id: community.id, title: "new title"}

      updated =
        rule_conn |> mutation_result(@update_community_query, variables, "updateCommunity")

      {:ok, found} = Community |> ORM.find(updated["id"])
      assert updated["id"] == to_string(found.id)
      assert updated["title"] == variables.title
    end

    test "update community with empty attrs return the same", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})
      variables = %{id: community.id}

      updated =
        rule_conn
        |> mutation_result(@update_community_query, variables, "updateCommunity")

      {:ok, found} = Community |> ORM.find(updated["id"])
      assert updated["id"] == to_string(found.id)
      assert updated["title"] == community.title
    end

    test "unauth user create community fails", ~m(user_conn guest_conn)a do
      variables = mock_attrs(:community)
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:account_login))

      assert rule_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:passport))
    end

    test "create duplicated community fails", %{community: community} do
      variables =
        mock_attrs(:community, %{
          slug: community.slug,
          title: community.title,
          desc: community.desc
        })

      rule_conn = simu_conn(:user, cms: %{"community.create" => true})

      assert rule_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:changeset))
    end

    @delete_community_query """
    mutation($id: ID!){
      deleteCommunity(id: $id) {
        id
      }
    }
    """
    test "auth user can delete community", ~m(community)a do
      variables = %{id: community.id}
      rule_conn = simu_conn(:user, cms: %{"community.delete" => true})

      deleted =
        rule_conn |> mutation_result(@delete_community_query, variables, "deleteCommunity")

      assert deleted["id"] == to_string(community.id)
      assert {:error, _} = ORM.find(Community, community.id)
    end

    test "unauth user delete community fails", ~m(user_conn guest_conn)a do
      variables = mock_attrs(:community)
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:account_login))

      assert rule_conn
             |> mutation_get_error?(@create_community_query, variables, ecode(:passport))
    end

    test "delete non-exist community fails" do
      rule_conn = simu_conn(:user, cms: %{"community.delete" => true})
      assert rule_conn |> mutation_get_error?(@delete_community_query, %{id: non_exist_id()})
    end
  end

  describe "[mutation cms thread]" do
    @query """
    mutation($title: String!, $slug: String!){
      createThread(title: $title, slug: $slug) {
        title
      }
    }
    """
    test "auth user can create thread", ~m(user)a do
      title = "other"
      slug = "OTHER"
      variables = ~m(title slug)a

      passport_rules = %{"thread.create" => true}
      rule_conn = simu_conn(:user, user, cms: passport_rules)

      result = rule_conn |> mutation_result(@query, variables, "createThread")

      assert result["title"] == title
    end

    test "unauth user create thread fails", ~m(user_conn guest_conn)a do
      title = "other"
      slug = "OTHER"
      variables = ~m(title slug)a
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($communityId: ID!, $threadId: ID!){
      setThread(communityId: $communityId, threadId: $threadId) {
        id
        threads {
          title
        }
      }
    }
    """
    test "auth user can add thread to community", ~m(user community)a do
      title = "other"
      slug = "OTHER"
      {:ok, thread} = CMS.create_thread(~m(title slug)a)
      variables = %{threadId: thread.id, communityId: community.id}

      passport_rules = %{community.title => %{"thread.set" => true}}
      rule_conn = simu_conn(:user, user, cms: passport_rules)

      result = rule_conn |> mutation_result(@query, variables, "setThread")

      assert result["threads"] |> Enum.at(1) |> Map.get("title") == title
      assert result["id"] == to_string(community.id)
    end

    @query """
    mutation($communityId: ID!, $threadId: ID!){
      unsetThread(communityId: $communityId, threadId: $threadId) {
        id
        threads {
          title
        }
      }
    }
    """
    test "auth user can remove thread from community", ~m(user community thread)a do
      CMS.set_thread(community, thread)
      {:ok, found_community} = Community |> ORM.find(community.id, preload: :threads)

      assert found_community.threads |> Enum.any?(&(&1.thread_id == thread.id))
      variables = %{threadId: thread.id, communityId: community.id}

      passport_rules = %{community.title => %{"thread.unset" => true}}
      rule_conn = simu_conn(:user, user, cms: passport_rules)

      result = rule_conn |> mutation_result(@query, variables, "unsetThread")
      assert result["threads"] |> Enum.count() == 5
    end
  end

  describe "[mutation cms moderators]" do
    @all_rules_query """
    query {
      allPassportRules {
        root
        moderator
      }
    }
    """
    test "can get all passport rules", ~m(user)a do
      rule_conn = simu_conn(:user, user)
      result = rule_conn |> query_result(@all_rules_query, %{}, "allPassportRules")

      assert is_binary(result["root"])
      assert is_binary(result["moderator"])

      assert is_map(Jason.decode!(result["root"]))
      assert is_map(Jason.decode!(result["moderator"]))
    end

    @set_moderator_query """
    mutation($community: String!, $user: String!, $role: String!){
      addModerator(community: $community, user: $user, role: $role) {
        slug
      }
    }
    """
    test "auth user can add moderator to community", ~m(user user2 community)a do
      role = "moderator"

      passport_rules = %{"moderator.set" => true}
      rule_conn = simu_conn(:user, user, cms: passport_rules)

      variables = %{user: user2.login, community: community.slug, role: role}

      result = rule_conn |> mutation_result(@set_moderator_query, variables, "addModerator")

      assert result["slug"] == community.slug
    end

    @unset_moderator_query """
    mutation($community: String!, $user: String!){
      removeModerator(community: $community, user: $user) {
        id
      }
    }
    """
    test "auth user can unset moderator AND passport from community", ~m(user community user2)a do
      role = "moderator"

      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      assert {:ok, _} =
               CommunityModerator |> ORM.find_by(user_id: user2.id, community_id: community.id)

      assert {:ok, _} = Passport |> ORM.find_by(user_id: user2.id)

      passport_rules = %{"moderator.unset" => true}
      rule_conn = simu_conn(:user, cur_user, cms: passport_rules)

      variables = %{user: user2.login, community: community.slug}

      rule_conn |> mutation_result(@unset_moderator_query, variables, "removeModerator")

      assert {:error, _} =
               CommunityModerator |> ORM.find_by(user_id: user2.id, community_id: community.id)
    end

    @update_moderator_query """
    mutation($community: String!, $user: String!, $rules: Json!){
      updateModeratorPassport(community: $community, user: $user, rules: $rules) {
        id
        moderators {
          role
          passportItemCount
          user {
            login
            nickname
          }
        }
      }
    }
    """
    test "auth user can update moderator to community", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user

      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      passport_rules = %{"moderator.update" => true}
      rule_conn = simu_conn(:user, user2, cms: passport_rules)
      root_rule_conn = simu_conn(:user, user, cms: passport_rules)

      new_passport_rules =
        Jason.encode!(%{
          "#{community.slug}" => %{
            "post.article.delete" => false,
            "post.tag.edit" => true,
            "post.tag.edit2" => true,
            "post.tag.edit3" => true
          }
        })

      variables = %{user: user2.login, community: community.slug, rules: new_passport_rules}

      assert rule_conn
             |> mutation_get_error?(
               @update_moderator_query,
               variables,
               ecode(:community_root_only)
             )

      result =
        root_rule_conn
        |> mutation_result(@update_moderator_query, variables, "updateModeratorPassport")

      {:ok, user2_passport} = CMS.get_passport(%User{id: user2.id})
      assert get_in(user2_passport, ["#{community.slug}", "post.tag.edit"])

      assert result["moderators"] |> List.first() |> get_in(["passportItemCount"]) == 3
    end

    test "unauth user add moderator fails", ~m(user_conn guest_conn user community)a do
      role = "moderator"

      variables = %{user: user.login, community: community.slug, role: role}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@set_moderator_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@set_moderator_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@set_moderator_query, variables, ecode(:passport))
    end
  end

  describe "[mutation cms subscribes]" do
    @subscribe_query """
    mutation($communityId: ID!){
      subscribeCommunity(communityId: $communityId) {
        id
      }
    }
    """
    test "login user can subscribe community", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}
      created = login_conn |> mutation_result(@subscribe_query, variables, "subscribeCommunity")

      assert created["id"] == to_string(community.id)
    end

    test "subscribe should update user's subscribed count", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}
      login_conn |> mutation_result(@subscribe_query, variables, "subscribeCommunity")

      {:ok, user} = ORM.find(User, user.id)

      assert user.subscribed_communities_count == 1
    end

    test "login user subscribe non-exist community fails", ~m(user)a do
      login_conn = simu_conn(:user, user)
      variables = %{communityId: non_exist_id()}

      assert login_conn |> mutation_get_error?(@subscribe_query, variables, ecode(:changeset))
    end

    test "guest user subscribe community fails", ~m(guest_conn community)a do
      variables = %{communityId: community.id}

      assert guest_conn |> mutation_get_error?(@subscribe_query, variables, ecode(:account_login))
    end

    test "subscribed community should inc it's own geo info", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}
      _created = login_conn |> mutation_result(@subscribe_query, variables, "subscribeCommunity")
      {:ok, community} = Community |> ORM.find(community.id)

      geo_info_data = community.geo_info |> Map.get("data")
      update_geo_city = geo_info_data |> Enum.find(fn g -> g["city"] == "成都" end)

      assert update_geo_city["value"] == 1
    end

    @unsubscribe_query """
    mutation($communityId: ID!){
      unsubscribeCommunity(communityId: $communityId) {
        id
      }
    }
    """
    test "login user can unsubscribe community", ~m(user community)a do
      {:ok, cur_subscribers} =
        CMS.community_members(:subscribers, %Community{id: community.id}, %{page: 1, size: 10})

      assert false == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))

      {:ok, record} = CMS.subscribe_community(community, user)

      {:ok, cur_subscribers} =
        CMS.community_members(:subscribers, %Community{id: community.id}, %{page: 1, size: 10})

      assert true == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}

      result =
        login_conn |> mutation_result(@unsubscribe_query, variables, "unsubscribeCommunity")

      {:ok, cur_subscribers} =
        CMS.community_members(:subscribers, %Community{id: community.id}, %{page: 1, size: 10})

      assert result["id"] == to_string(record.id)
      assert false == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))
    end

    test "unsubscribe should update user's subscribed count", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}
      login_conn |> mutation_result(@subscribe_query, variables, "subscribeCommunity")

      {:ok, user} = ORM.find(User, user.id)
      assert user.subscribed_communities_count == 1

      login_conn |> mutation_result(@unsubscribe_query, variables, "unsubscribeCommunity")

      {:ok, user} = ORM.find(User, user.id)
      assert user.subscribed_communities_count == 0
    end

    test "other login user unsubscribe community fails", ~m(user_conn community)a do
      variables = %{communityId: community.id}

      assert user_conn |> mutation_get_error?(@unsubscribe_query, variables)
    end

    test "guest user unsubscribe community fails", ~m(guest_conn community)a do
      variables = %{communityId: community.id}

      assert guest_conn
             |> mutation_get_error?(@unsubscribe_query, variables, ecode(:account_login))
    end

    test "unsubscribed community should dec it's own geo info", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{communityId: community.id}
      _created = login_conn |> mutation_result(@subscribe_query, variables, "subscribeCommunity")
      {:ok, community} = Community |> ORM.find(community.id)

      geo_info_data = community.geo_info |> Map.get("data")
      update_geo_city = geo_info_data |> Enum.find(fn g -> g["city"] == "成都" end)

      assert update_geo_city["value"] == 1

      variables = %{communityId: community.id}
      login_conn |> mutation_result(@unsubscribe_query, variables, "unsubscribeCommunity")

      {:ok, community} = Community |> ORM.find(community.id)

      geo_info_data = community.geo_info |> Map.get("data")
      update_geo_city = geo_info_data |> Enum.find(fn g -> g["city"] == "成都" end)

      assert update_geo_city["value"] == 0
    end
  end

  describe "mutation cms community apply" do
    @apply_community_query """
    mutation($title: String!, $desc: String!, $logo: String!, $slug: String!, $applyMsg: String, $applyCategory: String, $locale: String) {
      applyCommunity(title: $title, desc: $desc, logo: $logo, slug: $slug, applyMsg: $applyMsg, applyCategory: $applyCategory, locale: $locale) {
        id
        locale
        moderators {
          role
          user {
            login
            avatar
            nickname
          }
        }
        pending
        slug
        meta {
          applyMsg
          applyCategory
        }
      }
    }
    """
    test "apply a community should have default root user", ~m(user_conn)a do
      variables = mock_attrs(:community, %{locale: "it"})
      created = user_conn |> mutation_result(@apply_community_query, variables, "applyCommunity")

      {:ok, found} = Community |> ORM.find(created["id"])
      assert created["id"] == to_string(found.id)
      assert created["pending"] == @community_applying

      moderator = created["moderators"] |> Enum.at(0)
      assert moderator["role"] == "root"
      assert created["locale"] == "it"
    end

    @approve_community_query """
    mutation($community: String!) {
      approveCommunityApply(community: $community) {
        slug
        pending
      }
    }
    """
    test "can approve a community apply2", ~m(user_conn)a do
      variables = mock_attrs(:community)
      created = user_conn |> mutation_result(@apply_community_query, variables, "applyCommunity")

      variables = %{community: created["slug"]}
      rule_conn = simu_conn(:user, cms: %{"community.apply.approve" => true})

      rule_conn
      |> mutation_result(@approve_community_query, variables, "approveCommunityApply")

      {:ok, found} = Community |> ORM.find(created["id"])
      assert found.pending == @community_normal
    end

    @deny_community_query """
    mutation($id: ID!) {
      denyCommunityApply(id: $id) {
        id
        pending
      }
    }
    """
    test "can deny a community apply", ~m(user_conn)a do
      variables = mock_attrs(:community)
      created = user_conn |> mutation_result(@apply_community_query, variables, "applyCommunity")
      assert {:ok, _} = Community |> ORM.find(created["id"])

      variables = %{id: created["id"]}
      rule_conn = simu_conn(:user, cms: %{"community.apply.deny" => true})

      rule_conn
      |> mutation_result(@deny_community_query, variables, "denyCommunityApply")

      assert {:error, _} = Community |> ORM.find(created["id"])
    end
  end
end
