defmodule GroupherServer.Test.Query.CMS.CommunityTagGroups do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    tag_attrs = mock_attrs(:community_tag)

    {:ok, ~m(guest_conn community tag_attrs user)a}
  end

  describe "[cms query community tag groups]" do
    @query """
    query($community: String!, $thread: Thread) {
      communityTagGroups(community: $community, thread: $thread) {
        id
        title
        index
        tags {
          id
          title
          slug
          color
          thread
          group
          groupId
          index
          community {
            id
            title
            logo
          }
          stats {
            contentsCount
            todayContentsCount
          }
        }
      }
    }
    """

    test "guest user can get tag groups ordered by group index",
         ~m(guest_conn community tag_attrs user)a do
      {:ok, resources} = CMS.Communities.create_tag_group(community, :post, %{title: "Resources"})
      {:ok, general} = CMS.Communities.create_tag_group(community, :post, %{title: "General"})

      {:ok, _} =
        CMS.Communities.reindex_tag_groups(community, :post, [
          %{id: resources.id, index: 1},
          %{id: general.id, index: 0}
        ])

      {:ok, resource_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          Map.merge(tag_attrs, %{group_id: resources.id}),
          user
        )

      {:ok, general_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          tag_attrs |> unique_community_tag_attrs("2") |> Map.merge(%{group_id: general.id}),
          user
        )

      results =
        guest_conn
        |> gq_query(@query, %{community: community.slug, thread: "POST"})

      assert Enum.map(results, & &1["title"]) == ["General", "Resources"]

      [general_group, resources_group] = results

      assert get_in(general_group, ["tags", Access.at(0), "id"]) == to_string(general_tag.id)
      assert get_in(resources_group, ["tags", Access.at(0), "id"]) == to_string(resource_tag.id)
    end

    test "guest user can get post tag stats through tag groups",
         ~m(guest_conn community tag_attrs user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          Map.merge(tag_attrs, %{group: "General"}),
          user
        )

      post_attrs = mock_attrs(:post) |> Map.merge(%{community_tags: [article_tag.id]})
      {:ok, _post} = CMS.Articles.create(community, :post, post_attrs, user)

      results =
        guest_conn
        |> gq_query(@query, %{community: community.slug, thread: "POST"})

      stats = results |> List.first() |> get_in(["tags", Access.at(0), "stats"])

      assert stats["contentsCount"] == 1
      assert stats["todayContentsCount"] == 1
    end
  end
end
