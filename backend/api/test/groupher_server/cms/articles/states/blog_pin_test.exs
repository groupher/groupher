defmodule GroupherServer.Test.CMS.Articles.BlogPin do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat
  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

    {:ok, ~m(user community blog)a}
  end

  describe "[cms blog pin]" do
    test "can pin a blog", ~m(community blog user)a do
      {:ok, pinned_article} = CMS.Articles.pin(community, blog.id, user)
      assert Repo.get!(PinnedArticle, pinned_article.id).id == pinned_article.id
    end

    test "one community & thread can only pin certain count of blog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

        {:ok, _} = CMS.Articles.pin(community, new_blog.id, user)
        acc
      end)

      {:ok, new_blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      {:error, reason} = CMS.Articles.pin(community, new_blog.id, user)

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.too_much_pinned_article())
    end

    test "can undo pin to a blog", ~m(community blog user)a do
      {:ok, pin} = CMS.Articles.pin(community, blog.id, user)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, blog.id, user)

      refute Repo.get(PinnedArticle, pin.id)
    end
  end
end
