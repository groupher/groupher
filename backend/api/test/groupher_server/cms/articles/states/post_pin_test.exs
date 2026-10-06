defmodule GroupherServer.Test.CMS.Articles.PostPin do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat
  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

    {:ok, ~m(user community post)a}
  end

  describe "[cms post pin]" do
    test "can pin a post", ~m(community post user)a do
      {:ok, pinned_article} = CMS.Articles.pin(community, post.id, user)
      assert Repo.get!(PinnedArticle, pinned_article.id).id == pinned_article.id
    end

    test "one community & thread can only pin certain count of post", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
        {:ok, _} = CMS.Articles.pin(community, new_post.id, user)
        acc
      end)

      {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:error, reason} = CMS.Articles.pin(community, new_post.id, user)

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.too_much_pinned_article())
    end

    test "can undo pin to a post", ~m(community post user)a do
      {:ok, pin} = CMS.Articles.pin(community, post.id, user)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, post.id, user)
      refute Repo.get(PinnedArticle, pin.id)
    end
  end
end
