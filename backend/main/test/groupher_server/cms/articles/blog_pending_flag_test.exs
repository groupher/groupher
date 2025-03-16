defmodule GroupherServer.Test.CMS.BlogPendingFlag do
  @moduledoc false

  use GroupherServer.TestTools

  @total_count 35

  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, community2} = mock_community(user)

    {_, _, _, _} = mock_article(:doc, community2, user)

    blogs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.create_article(community, :blog, mock_attrs(:blog), user)
        acc ++ [value]
      end)

    blog_b = blogs |> List.first()
    blog_m = blogs |> Enum.at(div(@total_count, 2))
    blog_e = blogs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user blog_b blog_m blog_e)a}
  end

  describe "[pending blogs flags]" do
    test "pending blog can not be read", ~m(blog_m)a do
      {:ok, _} = CMS.read_article(blog_m.original_community_slug, :blog, blog_m.inner_id)

      {:ok, _} =
        CMS.set_article_illegal(:blog, blog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, blog_m} = ORM.find(Blog, blog_m.id)
      assert blog_m.pending == @audit_illegal

      {:error, reason} = CMS.read_article(blog_m.original_community_slug, :blog, blog_m.inner_id)
      assert reason |> is_error?(:pending)
    end

    test "author can read it's own pending blog", ~m(community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id)

      {:ok, _} =
        CMS.set_article_illegal(:blog, blog.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, blog_read} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      assert blog_read.id == blog.id

      {:ok, user2} = db_insert(:user)

      {:error, reason} =
        CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user2)

      assert reason |> is_error?(:pending)
    end

    test "pending blog can set/unset pending", ~m(blog_m)a do
      {:ok, _} = CMS.read_article(blog_m.original_community_slug, :blog, blog_m.inner_id)

      {:ok, _} =
        CMS.set_article_illegal(:blog, blog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, blog_m} = ORM.find(Blog, blog_m.id)
      assert blog_m.pending == @audit_illegal

      {:ok, _} = CMS.unset_article_illegal(:blog, blog_m.id, %{})

      {:ok, blog_m} = ORM.find(Blog, blog_m.id)
      assert blog_m.pending == @audit_legal

      {:ok, _} = CMS.read_article(blog_m.original_community_slug, :blog, blog_m.inner_id)
    end

    test "pending blog's meta should have info", ~m(blog_m)a do
      {:ok, _} = CMS.read_article(blog_m.original_community_slug, :blog, blog_m.inner_id)

      {:ok, _} =
        CMS.set_article_illegal(:blog, blog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"],
          illegal_articles: ["/blog/#{blog_m.id}"]
        })

      {:ok, blog_m} = ORM.find(Blog, blog_m.id)
      assert blog_m.pending == @audit_illegal
      assert not blog_m.meta.is_legal
      assert blog_m.meta.illegal_reason == ["some-reason"]
      assert blog_m.meta.illegal_words == ["some-word"]

      blog_m = Repo.preload(blog_m, :author)
      {:ok, user} = ORM.find(User, blog_m.author.user_id)
      assert user.meta.has_illegal_articles
      assert user.meta.illegal_articles == ["/blog/#{blog_m.id}"]

      {:ok, _} =
        CMS.unset_article_illegal(:blog, blog_m.id, %{
          is_legal: true,
          illegal_reason: [],
          illegal_words: [],
          illegal_articles: ["/blog/#{blog_m.id}"]
        })

      {:ok, blog_m} = ORM.find(Blog, blog_m.id)
      assert blog_m.pending == @audit_legal
      assert blog_m.meta.is_legal
      assert blog_m.meta.illegal_reason == []
      assert blog_m.meta.illegal_words == []

      blog_m = Repo.preload(blog_m, :author)
      {:ok, user} = ORM.find(User, blog_m.author.user_id)
      assert not user.meta.has_illegal_articles
      assert user.meta.illegal_articles == []
    end
  end

  # alias CMS.Delegate.Hooks

  # test "can audit paged audit failed blogs", ~m(blog_m)a do
  #   {:ok, blog} = ORM.find(Blog, blog_m.id)

  #   {:ok, blog} = CMS.set_article_audit_failed(blog, %{})

  #   {:ok, result} = CMS.paged_audit_failed_articles(:blog, %{page: 1, size: 20})
  #   assert result |> is_valid_pagination?(:raw)
  #   assert result.total_count == 1

  #   Enum.map(result.entries, fn blog ->
  #     Hooks.Audition.handle(blog)
  #   end)

  #   {:ok, result} = CMS.paged_audit_failed_articles(:blog, %{page: 1, size: 20})
  #   assert result.total_count == 0
  # end
end
