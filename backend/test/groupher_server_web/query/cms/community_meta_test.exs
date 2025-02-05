defmodule GroupherServer.Test.Query.CMS.CommunityMeta do
  @moduledoc false
  use GroupherServer.TestTools

  # alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})

    {:ok, ~m(guest_conn community_attrs user)a}
  end

  describe "[community meta]" do
    @query """
    query($slug: String!) {
      community(slug: $slug) {
        id
        title
        articlesCount
        meta {
          postsCount
          changelogsCount
          docsCount
          blogsCount
        }
      }
    }
    """
    test "community have valid [thread]s_count in meta info",
         ~m(guest_conn community_attrs user)a do
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, _} = CMS.create_article(community, :post, mock_attrs(:post), user)
      {:ok, _} = CMS.create_article(community, :post, mock_attrs(:post), user)

      {:ok, _} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
      {:ok, _} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)
      {:ok, _} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      {:ok, _} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      variables = %{slug: community.slug}
      results = guest_conn |> query_result(@query, variables, "community")

      meta = results["meta"]
      assert results["articlesCount"] == 8
      assert meta["postsCount"] == 2
      assert meta["changelogsCount"] == 2
      assert meta["docsCount"] == 3
      assert meta["blogsCount"] == 1
    end
  end
end
