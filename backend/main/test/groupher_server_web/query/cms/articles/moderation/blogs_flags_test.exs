defmodule GroupherServer.Test.Query.Flags.BlogsFlags do
  @moduledoc false

  use GroupherServer.TestTools

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    blogs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
        acc ++ [value]
      end)

    blog_b = blogs |> List.first()
    blog_m = blogs |> Enum.at(div(@total_count, 2))
    blog_e = blogs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user blog_b blog_m blog_e)a}
  end

  describe "[pending blogs flags]" do
    test "pending blog should not see in paged query",
         ~m(guest_conn community blog_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.Articles.set_illegal(:blog, blog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, blog_m} = CMS.FrontDesk.article(community, :blog, blog_m.inner_id)
      assert blog_m.pending == @audit_illegal

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned blogs flags]" do
    test "if have pinned blogs, the pinned blogs should at the top of entries",
         ~m(guest_conn community blog_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.Articles.pin(community, blog_m)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["innerId"] == to_string(blog_m.inner_id)
      assert entries_first["isPinned"] == true
    end

    test "pinned blogs should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, blog} = CMS.FrontDesk.article(community, :blog, random_id)
      {:ok, _} = CMS.Articles.pin(community, blog)
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "if have trashed blogs, the mark deleted blogs should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, random_blog} = CMS.FrontDesk.article(community, :blog, random_id)
      {:ok, _} = CMS.Articles.mark_delete(random_blog)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
