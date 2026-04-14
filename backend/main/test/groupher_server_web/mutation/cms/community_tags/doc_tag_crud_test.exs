defmodule GroupherServer.Test.Mutation.CMS.ArticleCommunityTags.DocTagCRUD do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  setup do
    {:ok, thread} = db_insert(:thread)
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    community_tag_attrs = mock_attrs(:community_tag)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community thread user community_tag_attrs)a}
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
    test "create tag with valid attrs, has default DOC thread and default docs",
         ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag_raw",
        community: community.slug,
        thread: "DOC",
        color: "GREEN",
        group: "awesome"
      }

      passport_rules = %{community.title => %{"doc.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      belong_community = created["community"]

      {:ok, found} = CommunityTag |> ORM.find(created["id"])

      assert created["id"] == to_string(found.id)
      assert found.thread == :doc
      assert found.group == "awesome"
      assert belong_community["id"] == to_string(community.id)
    end

    test "create tag with extra", ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "DOC",
        color: "GREEN",
        group: "awesome",
        extra: ["menuID", "menuID2"]
      }

      passport_rules = %{community.title => %{"doc.community_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> gq_mutation(@create_tag_query, variables)

      assert created["extra"] == ["menuID", "menuID2"]
    end

    test "unauth user create tag fails", ~m(community user_conn guest_conn)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "DOC",
        color: "GREEN"
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@create_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@create_tag_query, variables, ecode(:passport))
    end

    @update_tag_query """
    mutation($id: ID!, $color: RainbowColor, $title: String, $slug: String, $community: String!, $thread: Thread, $extra: [String], $icon: String) {
      updateCommunityTag(id: $id, color: $color, title: $title, slug: $slug, community: $community, thread: $thread, extra: $extra, icon: $icon) {
        id
        title
        color
        extra
        icon
      }
    }
    """
    test "auth user can update a tag", ~m(community_tag_attrs community user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      variables = %{
        id: community_tag.id,
        color: "YELLOW",
        title: "new title",
        slug: "new_title",
        community: community.slug,
        extra: ["newMenuID"],
        icon: "icon",
        thread: "DOC"
      }

      passport_rules = %{community.title => %{"doc.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(@update_tag_query, variables)

      assert updated["color"] == "YELLOW"
      assert updated["title"] == "new title"
      assert updated["extra"] == ["newMenuID"]
      assert updated["icon"] == "icon"
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
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug, thread: "DOC"}

      rule_conn =
        simu_conn(:user,
          cms: %{community.title => %{"doc.community_tag.delete" => true}}
        )

      deleted = rule_conn |> gq_mutation(@delete_tag_query, variables)

      assert deleted["id"] == to_string(community_tag.id)
    end

    test "unauth user delete tag fails",
         ~m(community_tag_attrs community user_conn guest_conn user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      variables = %{id: community_tag.id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@delete_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_error?(@delete_tag_query, variables, ecode(:passport))
    end
  end
end
