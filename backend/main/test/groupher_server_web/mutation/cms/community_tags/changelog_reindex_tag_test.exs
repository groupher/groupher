defmodule GroupherServer.Test.Mutation.CommunityTags.ChangelogReindexTag do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  setup do
    {:ok, changelog} = db_insert(:changelog)
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    community_tag_attrs = mock_attrs(:community_tag)

    {:ok, ~m(user_conn guest_conn owner_conn community changelog community_tag_attrs user)a}
  end

  describe "[mutation changelog tag]" do
    @query """
    mutation($community: String!, $thread: Thread, $group: String!, $tags: [ReindexTagInput]) {
      reindexTagsInGroup(community: $community, thread: $thread, group: $group, tags: $tags) {
        done
      }
    }
    """
    test "auth user can reindex tags in given group", ~m(community community_tag_attrs user)a do
      attrs = Map.merge(community_tag_attrs, %{group: "group1"})

      {:ok, community_tag1} = CMS.Communities.create_tag(community, :changelog, attrs, user)
      {:ok, community_tag2} = CMS.Communities.create_tag(community, :changelog, attrs, user)
      {:ok, community_tag3} = CMS.Communities.create_tag(community, :changelog, attrs, user)
      {:ok, community_tag4} = CMS.Communities.create_tag(community, :changelog, attrs, user)

      passport_rules = %{community.title => %{"changelog.community_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        community: community.slug,
        thread: "CHANGELOG",
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
  end
end
