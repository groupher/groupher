defmodule GroupherServer.Test.Mutation.CommunityTags.PostReindexTag do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  setup do
    {:ok, post} = db_insert(:post)
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    community_tag_attrs = mock_attrs(:community_tag)

    {:ok, ~m(user_conn guest_conn owner_conn community post community_tag_attrs user)a}
  end

  describe "[mutation post tag]" do
    @query """
    mutation($community: String!, $thread: Thread, $group: String!, $tags: [ReindexTagInput]) {
      reindexTagsInGroup(community: $community, thread: $thread, group: $group, tags: $tags) {
        done
      }
    }
    """
    test "auth user can reindex tags in given group", ~m(community community_tag_attrs user)a do
      attrs = Map.merge(community_tag_attrs, %{group: "group1"})

      {:ok, community_tag1} = CMS.Communities.create_tag(community, :post, attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "2"), user)

      {:ok, community_tag3} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "3"), user)

      {:ok, community_tag4} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "4"), user)

      passport_rules = %{community.title => %{"post.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        community: community.slug,
        thread: "POST",
        group: "group1",
        tags: [
          %{
            id: community_tag1.id,
            index: 1
          },
          %{
            id: community_tag2.id,
            index: 2
          },
          %{
            id: community_tag3.id,
            index: 3
          },
          %{
            id: community_tag4.id,
            index: 4
          }
        ]
      }

      rule_conn |> gq_mutation(@query, variables)

      {:ok, community_tag1_after} = ORM.find(CommunityTag, community_tag1.id)
      {:ok, community_tag2_after} = ORM.find(CommunityTag, community_tag2.id)
      {:ok, community_tag3_after} = ORM.find(CommunityTag, community_tag3.id)
      {:ok, community_tag4_after} = ORM.find(CommunityTag, community_tag4.id)

      assert community_tag1_after.index === 1
      assert community_tag2_after.index === 2
      assert community_tag3_after.index === 3
      assert community_tag4_after.index === 4
    end

    @across_groups_query """
    mutation($community: String!, $thread: Thread, $tags: [ReindexCommunityTagInput]) {
      reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {
        done
      }
    }
    """
    test "auth user can reindex tags across groups", ~m(community community_tag_attrs user)a do
      resources_attrs = Map.merge(community_tag_attrs, %{group: "Resources"})
      general_attrs = Map.merge(community_tag_attrs, %{group: "General"})

      {:ok, community_tag1} = CMS.Communities.create_tag(community, :post, resources_attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(resources_attrs, "2"),
          user
        )

      {:ok, community_tag3} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(general_attrs, "3"),
          user
        )

      {:ok, community_tag4} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(general_attrs, "4"),
          user
        )

      passport_rules = %{community.title => %{"post.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        community: community.slug,
        thread: "POST",
        tags: [
          %{
            id: community_tag1.id,
            group: "General",
            index: 1
          },
          %{
            id: community_tag2.id,
            group: "Resources",
            index: 0
          },
          %{
            id: community_tag3.id,
            group: "Resources",
            index: 1
          },
          %{
            id: community_tag4.id,
            group: "General",
            index: 0
          }
        ]
      }

      rule_conn |> gq_mutation(@across_groups_query, variables)

      {:ok, community_tag1_after} = ORM.find(CommunityTag, community_tag1.id)
      {:ok, community_tag2_after} = ORM.find(CommunityTag, community_tag2.id)
      {:ok, community_tag3_after} = ORM.find(CommunityTag, community_tag3.id)
      {:ok, community_tag4_after} = ORM.find(CommunityTag, community_tag4.id)

      assert community_tag1_after.group === "General"
      assert community_tag1_after.index === 1
      assert community_tag2_after.group === "Resources"
      assert community_tag2_after.index === 0
      assert community_tag3_after.group === "Resources"
      assert community_tag3_after.index === 1
      assert community_tag4_after.group === "General"
      assert community_tag4_after.index === 0
    end
  end
end
