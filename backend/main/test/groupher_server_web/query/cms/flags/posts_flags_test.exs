defmodule GroupherServer.Test.Query.Flags.PostsFlags do
  @moduledoc false

  use GroupherServer.TestTools

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    posts =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.create_article(community, :post, mock_attrs(:post), user)
        acc ++ [value]
      end)

    post_b = posts |> List.first()
    post_m = posts |> Enum.at(div(@total_count, 2))
    post_e = posts |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user post_b post_m post_e)a}
  end

  describe "[pending posts flags]" do
    @query """
    query($filter: PagedPostsFilter!) {
      pagedPosts(filter: $filter) {
        entries {
          id
          pending
          communities {
            slug
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "pending post should not see in paged query", ~m(guest_conn community post_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.set_article_illegal(:post, post_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, post_m} = ORM.find(CMS.Model.Post, post_m.id)
      assert post_m.pending == @audit_illegal

      results = guest_conn |> gq_query(@query, variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned posts flags]" do
    @query """
    query($filter: PagedPostsFilter!) {
      pagedPosts(filter: $filter) {
        entries {
          id
          isPinned
          communities {
            slug
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "if have pinned posts, the pinned posts should at the top of entries",
         ~m(guest_conn community post_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _pined_post} = CMS.pin_article(community, post_m)

      results = guest_conn |> gq_query(@query, variables)
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["id"] == to_string(post_m.id)
      assert entries_first["isPinned"] == true
    end

    test "pinned posts should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> gq_query(@query, variables)
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")
      {:ok, post} = ORM.find(Post, random_id)
      {:ok, _} = CMS.pin_article(community, post)

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "if have trashed posts, the mark deleted posts should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(@query, variables)

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")
      {:ok, _} = CMS.mark_delete_article(:post, random_id)

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
