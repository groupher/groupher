defmodule GroupherServer.Test.CMS.Articles.BlogPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

    {:ok, ~m(user community blog)a}
  end

  describe "[cms blog pin]" do
    test "can pin a blog", ~m(community blog)a do
      {:ok, _} = CMS.Articles.pin(community, blog)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{blog_id: blog.id})

      assert pinned_article.blog_id == blog.id
    end

    test "one community & thread can only pin certain count of blog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

        {:ok, _} = CMS.Articles.pin(community, new_blog)
        acc
      end)

      {:ok, new_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      {:error, reason} = CMS.Articles.pin(community, new_blog)
      assert error_code(reason) == ecode(:too_much_pinned_article)
    end

    test "can undo pin to a blog", ~m(community blog)a do
      {:ok, _} = CMS.Articles.pin(community, blog)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, blog)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{blog_id: blog.id})
    end
  end
end
