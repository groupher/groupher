defmodule GroupherServer.Test.Mutation.CMS.ArticleCommunityTags.PostTagCRUD do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  setup do
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    community_tag_attrs = mock_attrs(:community_tag)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community user community_tag_attrs)a}
  end

  describe "[mutation cms tag]" do
    @create_tag_query """
    mutation($thread: Thread!, $title: String!, $slug: String!, $color: RainbowColor!, $group: String, $community: String!, $extra: [String] ) {
      createCommunityTag(thread: $thread, title: $title, slug: $slug, color: $color, group: $group, community: $community, extra: $extra) {
        id
        title
        color
        thread
        group
        extra
        community {
          id
          logo
          title
        }
      }
    }
    """
    test "create tag with valid attrs, has default POST thread and default posts",
         ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag_raw",
        community: community.slug,
        thread: "POST",
        color: "GREEN",
        group: "awesome"
      }

      passport_rules = %{community.title => %{"post.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      belong_community = created["community"]

      {:ok, found} = CommunityTag |> ORM.find(created["id"])

      assert created["id"] == to_string(found.id)
      assert found.thread == :post
      assert found.group == "awesome"
      assert belong_community["id"] == to_string(community.id)
    end

    test "create tag with extra", ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "POST",
        color: "GREEN",
        group: "awesome",
        extra: ["menuID", "menuID2"]
      }

      passport_rules = %{community.title => %{"post.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      assert created["extra"] == ["menuID", "menuID2"]
    end

    test "unauth user create tag fails", ~m(community user_conn guest_conn)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "POST",
        color: "GREEN"
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@create_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))
    end

    @update_tag_query """
    mutation($id: ID!, $color: RainbowColor, $title: String, $desc: String, $slug: String, $community: String!, $extra: [String], $icon: String, $group: String) {
      updateCommunityTag(id: $id, color: $color, title: $title, desc: $desc, slug: $slug, community: $community, extra: $extra, icon: $icon, group: $group) {
        id
        title
        desc
        color
        group
        extra
        icon
      }
    }
    """
    test "auth user can update a tag", ~m(community_tag_attrs community user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      variables = %{
        id: community_tag.id,
        color: "YELLOW",
        title: "new title",
        desc: "this tag is awesome",
        slug: "new_title",
        community: community.slug,
        group: "new group",
        extra: ["newMenuID"],
        icon: "icon"
      }

      passport_rules = %{community.title => %{"post.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(@update_tag_query, variables)

      assert updated["color"] == "YELLOW"
      assert updated["title"] == "new title"
      assert updated["desc"] == "this tag is awesome"
      assert updated["group"] == "new group"
      assert updated["extra"] == ["newMenuID"]
      assert updated["icon"] == "icon"
    end

    @delete_tag_query """
    mutation($id: ID!, $community: String!){
      deleteCommunityTag(id: $id, community: $community) {
        id
      }
    }
    """
    test "auth user can delete tag", ~m(community_tag_attrs community user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug}

      rule_conn =
        simu_conn(:user,
          cms: %{community.title => %{"post.community_tag.delete" => true}}
        )

      deleted = rule_conn |> gq_mutation(@delete_tag_query, variables)

      assert deleted["id"] == to_string(community_tag.id)
    end

    test "unauth user delete tag fails",
         ~m(community_tag_attrs community user_conn guest_conn user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@delete_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))
    end
  end
end
