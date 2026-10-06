defmodule GroupherServer.Test.Query.Flags.BlogsFlags do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @total_count 35
  @page_size GroupherServerWeb.Config.page_size()

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
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.Articles.set_illegal(
          blog_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      blog_m = Repo.get!(CMS.Model.Article, blog_m.article_id)

      assert blog_m.moderation_state == :illegal

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned blogs flags]" do
    test "if have pinned blogs, the pinned blogs should at the top of entries",
         ~m(guest_conn community blog_m user)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.Articles.pin(community, blog_m.article_id, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["innerId"] == to_string(blog_m.inner_id)
      assert entries_first["isPinned"] == true
    end

    test "pinned blogs should not appear when page > 1", ~m(guest_conn community user)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, blog} = read_article(community, :blog, random_id)
      {:ok, _} = CMS.Articles.pin(community, blog.article_id, user)
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "trashed blogs do not appear in results, including pinned injection",
         ~m(guest_conn community user)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, random_blog} = read_article(community, :blog, random_id)
      {:ok, _} = CMS.Articles.pin(community, random_blog.article_id, user)
      {:ok, _} = CMS.Articles.trash(random_blog, user)

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :blog), variables)

      refute results["entries"] |> Enum.any?(&(&1["innerId"] == random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
