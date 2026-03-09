defmodule GroupherServer.Test.Query.CMS.PostTags do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community article_tag_attrs article_tag_attrs2 user)a}
  end

  describe "[cms query tags]" do
    @query """
    query($filter: CommunityTagsFilter) {
      pagedCommunityTags(filter: $filter) {
        entries {
          id
          title
          slug
          color
          thread
          extra
          community {
            id
            title
            logo
          }
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
    test "guest user can get paged tags without filter",
         ~m(guest_conn community article_tag_attrs user)a do
      variables = %{}
      {:ok, _article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1
    end

    test "guest user can get all paged tags belongs to a community",
         ~m(guest_conn community article_tag_attrs user)a do
      {:ok, _article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 1
    end

    test "guest user can get tags by community and thread",
         ~m(guest_conn community  article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      variables = %{filter: %{community: community.slug, thread: "POST"}}
      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 1

      tag = results["entries"] |> List.first()
      assert tag["id"] == to_string(article_tag.id)
    end
  end
end
