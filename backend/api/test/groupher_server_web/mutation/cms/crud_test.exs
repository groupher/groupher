defmodule GroupherServer.Test.Mutation.CMS.CRUD do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Passport.ErrorCat, as: PassportErrorCat
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat

  alias GroupherServer.CMS
  alias CMS.Communities.Categories.Persist, as: CategoriesPersist
  alias CMS.Model.{Category, CommunityLifecycle, CommunityAdmin, Passport}

  setup do
    {:ok, category} = db_insert(:category)
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = mock_community(user)

    user_conn = simu_conn(:user)
    user_conn2 = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn user_conn2 guest_conn community category user user2)a}
  end

  test "dashboard Pagi mutation saves both device preferences", %{community: community} do
    query = """
    mutation($community: String!, $mode: PagiMode!, $mobileMode: PagiMode!, $expectedRevision: Int!, $commandId: ID!) {
      updateDashboardPagiMode(community: $community, mode: $mode, mobileMode: $mobileMode, expectedRevision: $expectedRevision, commandId: $commandId) {
        pagiMode pagiMobileMode pagiRevision
      }
    }
    """

    conn = simu_conn(:user, cms: %{"community.update" => true})

    variables = %{
      community: community.slug,
      mode: "PAGE",
      mobileMode: "LOAD_MORE",
      expectedRevision: 0,
      commandId: Ecto.UUID.generate()
    }

    saved = gq_mutation(conn, query, variables)
    assert saved["pagiMode"] == "PAGE"
    assert saved["pagiMobileMode"] == "LOAD_MORE"
    assert saved["pagiRevision"] == 1
  end

  test "dashboard enable mutation exposes nullable published editing settings", %{
    community: community
  } do
    query = """
    mutation($community: String!, $post: Boolean, $blog: Boolean, $commandId: ID!) {
      updateDashboardEnable(community: $community, postPublishedEditing: $post,
                            blogPublishedEditing: $blog, commandId: $commandId) {
        enable { postPublishedEditing blogPublishedEditing changelogPublishedEditing }
      }
    }
    """

    conn = simu_conn(:user, cms: %{"community.update" => true})

    saved =
      gq_mutation(conn, query, %{
        community: community.slug,
        post: false,
        blog: nil,
        commandId: Ecto.UUID.generate()
      })

    assert saved["enable"] == %{
             "postPublishedEditing" => false,
             "blogPublishedEditing" => nil,
             "changelogPublishedEditing" => nil
           }
  end

  describe "mutation cms category" do
    @create_category_query S.Category.m(:create_category)
    test "auth user can create category", ~m(user community)a do
      variables = mock_attrs(:category, %{user_id: user.id, community: community.slug})
      variables = Map.put(variables, :command_id, Ecto.UUID.generate())
      rule_conn = simu_conn(:user, cms: %{"category.create" => true})

      created = rule_conn |> gq_mutation(@create_category_query, variables)
      # author = created["author"]
      assert created["title"] == variables.title
    end

    @delete_category_query S.Category.m(:delete_category)
    test "auth user can delete category", ~m(community)a do
      {:ok, category} = db_insert(:category)
      {:ok, _} = CategoriesPersist.set_category(community, category)
      rule_conn = simu_conn(:user, cms: %{"category.delete" => true})

      variables = %{community: community.slug, id: category.id, command_id: Ecto.UUID.generate()}
      deleted = rule_conn |> gq_mutation(@delete_category_query, variables)

      assert deleted["id"] == to_string(category.id)
    end

    @update_category_query S.Category.m(:update_category)
    test "auth user can update  category", ~m(category community)a do
      {:ok, _} = CategoriesPersist.set_category(community, category)
      rule_conn = simu_conn(:user, cms: %{"category.update" => true})

      variables = %{
        community: community.slug,
        id: category.id,
        title: "new title",
        command_id: Ecto.UUID.generate()
      }

      updated = rule_conn |> gq_mutation(@update_category_query, variables)
      assert updated["title"] == "new title"
    end

    test "unauth user create category fails", ~m(user user_conn guest_conn community)a do
      variables = mock_attrs(:category, %{user_id: user.id, community: community.slug})
      variables = Map.put(variables, :command_id, Ecto.UUID.generate())
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               @create_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @create_category_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @create_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )
    end

    test "unauth user update category fails", ~m(category user_conn guest_conn community)a do
      variables = %{
        community: community.slug,
        id: category.id,
        title: "new title",
        command_id: Ecto.UUID.generate()
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               @update_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @update_category_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @update_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )
    end

    @set_category_query S.Category.m(:set_category)
    test "auth user can set a category to a community" do
      {:ok, community} = mock_community()
      {:ok, category} = db_insert(:category)

      rule_conn = simu_conn(:user, cms: %{"category.set" => true})

      variables = %{
        community: community.slug,
        categoryId: category.id,
        commandId: Ecto.UUID.generate()
      }

      rule_conn |> gq_mutation(@set_category_query, variables)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categories = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id in assoc_categories
      assert community.id in assoc_communities
    end

    @unset_category_query S.Category.m(:unset_category)
    test "auth user can unset a category to a community" do
      {:ok, community} = mock_community()
      {:ok, category} = db_insert(:category)

      {:ok, _} = CategoriesPersist.set_category(community, %Category{id: category.id})

      rule_conn = simu_conn(:user, cms: %{"category.unset" => true})

      variables = %{
        community: community.slug,
        categoryId: category.id,
        commandId: Ecto.UUID.generate()
      }

      rule_conn |> gq_mutation(@unset_category_query, variables)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categories = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id not in assoc_categories
      assert community.id not in assoc_communities
    end

    test "unauth user set/unset category fails", ~m(user_conn guest_conn)a do
      {:ok, user} = db_insert(:user)
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())
      {:ok, category} = db_insert(:category)

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      variables = %{
        community: community.slug,
        categoryId: category.id,
        commandId: Ecto.UUID.generate()
      }

      assert user_conn
             |> mutation_error?(
               @set_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @set_category_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @set_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert user_conn
             |> mutation_error?(
               @unset_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @unset_category_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @unset_category_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )
    end
  end

  describe "[mutation cms community]" do
    @create_community_query S.Community.m(:create_community)
    test "create community with valid attrs" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = create_community_vars(%{locale: "zh"})

      created =
        rule_conn |> gq_mutation(@create_community_query, variables)

      {:ok, found} = Community |> ORM.find_by(%{slug: created["slug"]})
      assert created["slug"] == found.slug
      assert created["locale"] == "zh"
    end

    test "can create community with some title, different slug" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = create_community_vars(%{title: "elixir", slug: "elixir1"})
      rule_conn |> gq_mutation(@create_community_query, variables)
      variables = create_community_vars(%{title: "elixir", slug: "elixir2"})
      rule_conn |> gq_mutation(@create_community_query, variables)

      {:ok, community} = Community |> ORM.find_by(%{slug: "elixir1"})
      assert community.title == "elixir"

      {:ok, community} = Community |> ORM.find_by(%{slug: "elixir2"})
      assert community.title == "elixir"
    end

    test "can not create community with some slug" do
      rule_conn = simu_conn(:user, cms: %{"community.create" => true})
      variables = create_community_vars(%{title: "elixir1", slug: "elixir"})

      first = rule_conn |> gq_mutation(@create_community_query, variables)
      assert not is_nil(first)

      variables = create_community_vars(%{title: "elixir2", slug: "elixir"})
      assert rule_conn |> mutation_error?(@create_community_query, variables)
    end

    @update_community_query S.Community.m(:update_community)
    test "update community with valid attrs", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})

      variables = %{
        community: community.slug,
        title: "new title",
        command_id: Ecto.UUID.generate()
      }

      updated = rule_conn |> gq_mutation(@update_community_query, variables)

      {:ok, found} = Community |> ORM.find_by(%{slug: updated["slug"]})
      assert updated["slug"] == found.slug
      assert updated["title"] == variables.title
    end

    test "update community with empty attrs return the same", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{"community.update" => true})
      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}

      updated = rule_conn |> gq_mutation(@update_community_query, variables)

      {:ok, found} = Community |> ORM.find_by(%{slug: updated["slug"]})
      assert updated["slug"] == found.slug
      assert updated["title"] == community.title
    end

    test "unauth user create community fails", ~m(user_conn guest_conn)a do
      variables = create_community_vars()
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )
    end

    test "create duplicated community fails", %{community: community} do
      variables =
        create_community_vars(%{
          slug: community.slug,
          title: community.title,
          desc: community.desc
        })

      rule_conn = simu_conn(:user, cms: %{"community.create" => true})

      assert rule_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(WebErrorCat.changeset())
             )
    end

    @request_destroy_community_query S.Community.m(:request_destroy_community)
    test "auth user can request community destruction", ~m(community)a do
      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}
      rule_conn = simu_conn(:user, cms: %{"community.request_destroy" => true})

      archived = rule_conn |> gq_mutation(@request_destroy_community_query, variables)

      assert archived["slug"] == community.slug
      assert {:ok, _community} = ORM.find(Community, community.id)
      assert Repo.get_by!(CommunityLifecycle, community_id: community.id).state == :archived
    end

    test "unauth user delete community fails", ~m(user_conn guest_conn)a do
      variables = create_community_vars()
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               @create_community_query,
               variables,
               ErrorCat.code(PassportErrorCat.permission_denied())
             )
    end

    test "delete non-exist community fails" do
      rule_conn = simu_conn(:user, cms: %{"community.request_destroy" => true})

      assert rule_conn
             |> mutation_error?(@request_destroy_community_query, %{community: non_exist_slug()})
    end
  end

  defp create_community_vars(attrs \\ %{}) do
    mock_attrs(:community, attrs)
    |> Map.put(:command_id, Ecto.UUID.generate())
  end

  describe "[mutation cms subscribes]" do
    @subscribe_query S.Community.m(:subscribe_community)
    test "login user can subscribe community", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}
      created = login_conn |> gq_mutation(@subscribe_query, variables)

      assert created["slug"] == community.slug
    end

    test "subscribe should update user's subscribed count.", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}
      login_conn |> gq_mutation(@subscribe_query, variables)

      {:ok, user} = ORM.find(User, user.id)

      assert user.subscribed_communities_count == 1
    end

    test "login user subscribe non-exist community fails", ~m(user)a do
      login_conn = simu_conn(:user, user)
      variables = %{community: non_exist_slug(), command_id: Ecto.UUID.generate()}

      assert login_conn
             |> mutation_error?(
               @subscribe_query,
               variables,
               ErrorCat.code(CommunityErrorCat.not_exist())
             )
    end

    test "guest user subscribe community fails", ~m(guest_conn community)a do
      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}

      assert guest_conn
             |> mutation_error?(
               @subscribe_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )
    end

    @unsubscribe_query S.Community.m(:unsubscribe_community)
    test "login user can unsubscribe community", ~m(user community)a do
      {:ok, cur_subscribers} =
        CMS.Communities.members(:subscribers, community, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert false == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))

      {:ok, _record} = CMS.Communities.Subscriptions.Setup.subscribe(community, user)

      {:ok, cur_subscribers} =
        CMS.Communities.members(:subscribers, community, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert true == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))
      login_conn = simu_conn(:user, user)

      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}

      result = login_conn |> gq_mutation(@unsubscribe_query, variables)

      {:ok, cur_subscribers} =
        CMS.Communities.members(
          :subscribers,
          %Community{id: community.id},
          %{},
          %GroupherServer.Pagi.Params.Offset{page: 1, size: 10}
        )

      assert result["slug"] == community.slug
      assert false == cur_subscribers.entries |> Enum.any?(&(&1.id == user.id))
    end

    test "unsubscribe should update user's subscribed count", ~m(user community)a do
      login_conn = simu_conn(:user, user)

      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}
      login_conn |> gq_mutation(@subscribe_query, variables)

      {:ok, user} = ORM.find(User, user.id)
      assert user.subscribed_communities_count == 1

      unsubscribe_variables = %{community: community.slug, command_id: Ecto.UUID.generate()}
      login_conn |> gq_mutation(@unsubscribe_query, unsubscribe_variables)

      {:ok, user} = ORM.find(User, user.id)
      assert user.subscribed_communities_count == 0
    end

    test "other login user unsubscribe community fails", ~m(user_conn community)a do
      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}

      assert user_conn |> mutation_error?(@unsubscribe_query, variables)
    end

    test "guest user unsubscribe community fails", ~m(guest_conn community)a do
      variables = %{community: community.slug, command_id: Ecto.UUID.generate()}

      assert guest_conn
             |> mutation_error?(
               @unsubscribe_query,
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )
    end
  end

end
