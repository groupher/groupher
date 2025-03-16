defmodule GroupherServer.Test.CMS.Articles.BlogPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

    {:ok, ~m(user community blog)a}
  end

  describe "[cms blog pin]" do
    @tag :wip
    test "can pin a blog", ~m(community blog)a do
      {:ok, _} = CMS.pin_article(community, blog)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{blog_id: blog.id})

      assert pinned_article.blog_id == blog.id
    end

    @tag :wip
    test "one community & thread can only pin certain count of blog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

        {:ok, _} = CMS.pin_article(community, new_blog)
        acc
      end)

      {:ok, new_blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      {:error, reason} = CMS.pin_article(community, new_blog)
      assert reason |> Keyword.get(:code) == ecode(:too_much_pinned_article)
    end

    @tag :wip
    test "can undo pin to a blog", ~m(community blog)a do
      {:ok, _} = CMS.pin_article(community, blog)

      assert {:ok, _unpinned} = CMS.undo_pin_article(community, blog)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{blog_id: blog.id})
    end
  end
end
