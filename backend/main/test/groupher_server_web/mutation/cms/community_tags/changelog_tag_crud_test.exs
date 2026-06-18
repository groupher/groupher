defmodule GroupherServer.Test.Mutation.CMS.ArticleCommunityTags.ChangelogTagCRUD do
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
    mutation($thread: Thread!, $title: String!, $slug: String!, $color: RainbowColor!, $groupId: ID!, $community: String!, $extra: [String] ) {
      createCommunityTag(thread: $thread, title: $title, slug: $slug, color: $color, groupId: $groupId, community: $community, extra: $extra) {
        id
        title
        color
        thread
        group
        groupId
        extra
        community {
          id
          logo
          title
        }
      }
    }
    """
    test "create tag with valid attrs, has default CHANGELOG thread and default changelogs",
         ~m(community)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :changelog, %{title: "awesome"})

      variables = %{
        title: "tag title",
        slug: "tag_slug",
        community: community.slug,
        thread: "CHANGELOG",
        color: "GREEN",
        groupId: group.id
      }

      passport_rules = %{community.title => %{"changelog.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      belong_community = created["community"]

      {:ok, found} = CommunityTag |> ORM.find(created["id"])

      assert created["id"] == to_string(found.id)
      assert found.thread == :changelog
      assert found.group_id == group.id
      assert created["group"] == "awesome"
      assert belong_community["id"] == to_string(community.id)
    end

    test "create tag with extra", ~m(community)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :changelog, %{title: "awesome"})

      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "CHANGELOG",
        color: "GREEN",
        groupId: group.id,
        extra: ["menuID", "menuID2"]
      }

      passport_rules = %{community.title => %{"changelog.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      assert created["extra"] == ["menuID", "menuID2"]
    end

    test "unauth user create tag fails", ~m(community user_conn guest_conn)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :changelog, %{title: "awesome"})

      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "CHANGELOG",
        color: "GREEN",
        groupId: group.id
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@create_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))
    end

    @update_tag_query """
    mutation($id: ID!, $color: RainbowColor, $title: String, $slug: String, $community: String!, $thread: Thread, $extra: [String], $marker: MarkerInput) {
      updateCommunityTag(id: $id, color: $color, title: $title, slug: $slug, community: $community, thread: $thread, extra: $extra, marker: $marker) {
        id
        title
        color
        extra
        marker {
          type
          provider
          name
          src
          unified
        }
      }
    }
    """
    test "auth user can update a tag", ~m(community_tag_attrs community user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :changelog, community_tag_attrs, user)

      variables = %{
        id: community_tag.id,
        color: "YELLOW",
        title: "new title",
        slug: "new_title",
        community: community.slug,
        extra: ["newMenuID"],
        marker: %{type: "ICON", provider: "lucide", name: "tag", src: "/icons/lucide/tag.svg"},
        thread: "CHANGELOG"
      }

      passport_rules = %{community.title => %{"changelog.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(@update_tag_query, variables)

      assert updated["color"] == "YELLOW"
      assert updated["title"] == "new title"
      assert updated["extra"] == ["newMenuID"]

      assert updated["marker"] == %{
               "type" => "ICON",
               "provider" => "lucide",
               "name" => "tag",
               "src" => "/icons/lucide/tag.svg",
               "unified" => nil
             }
    end

    @delete_tag_query """
    mutation($id: ID!, $community: String!, $thread: Thread){
      deleteCommunityTag(id: $id, community: $community, thread: $thread) {
        id
      }
    }
    """
    test "auth user can delete tag", ~m(community_tag_attrs community user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :changelog, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug, thread: "CHANGELOG"}

      rule_conn =
        simu_conn(:user,
          cms: %{community.title => %{"changelog.community_tag.delete" => true}}
        )

      deleted = rule_conn |> gq_mutation(@delete_tag_query, variables)

      assert deleted["id"] == to_string(community_tag.id)
    end

    test "unauth user delete tag fails",
         ~m(community_tag_attrs community user_conn guest_conn user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :changelog, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@delete_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))
    end
  end
end
