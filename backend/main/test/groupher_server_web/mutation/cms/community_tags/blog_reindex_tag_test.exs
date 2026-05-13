defmodule GroupherServer.Test.Mutation.CommunityTags.BlogReindexTag do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  setup do
    {:ok, blog} = db_insert(:blog)
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, blog)

    community_tag_attrs = mock_attrs(:community_tag)

    {:ok, ~m(user_conn guest_conn owner_conn community blog community_tag_attrs user)a}
  end

  describe "[mutation blog tag]" do
    @query """
    mutation($community: String!, $thread: Thread, $groupId: ID!, $tags: [ReindexTagInput]) {
      reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {
        done
      }
    }
    """
    test "auth user can reindex tags in given group", ~m(community community_tag_attrs user)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :blog, %{title: "group1"})
      attrs = Map.merge(community_tag_attrs, %{group_id: group.id})

      {:ok, community_tag1} = CMS.Communities.create_tag(community, :blog, attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(community, :blog, unique_community_tag_attrs(attrs, "2"), user)

      {:ok, community_tag3} =
        CMS.Communities.create_tag(community, :blog, unique_community_tag_attrs(attrs, "3"), user)

      {:ok, community_tag4} =
        CMS.Communities.create_tag(community, :blog, unique_community_tag_attrs(attrs, "4"), user)

      passport_rules = %{community.title => %{"blog.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        community: community.slug,
        thread: "BLOG",
        groupId: group.id,
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
  end
end
