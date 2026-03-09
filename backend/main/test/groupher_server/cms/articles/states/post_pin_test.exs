defmodule GroupherServer.Test.CMS.Articles.PostPin do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

    {:ok, ~m(user community post)a}
  end

  describe "[cms post pin]" do
    test "can pin a post", ~m(community post)a do
      {:ok, _} = CMS.Articles.pin(community, post)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{post_id: post.id})

      assert pinned_article.post_id == post.id
    end

    test "one community & thread can only pin certain count of post", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
        {:ok, _} = CMS.Articles.pin(community, new_post)
        acc
      end)

      {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:error, reason} = CMS.Articles.pin(community, new_post)
      assert error_code(reason) == ecode(:too_much_pinned_article)
    end

    test "can undo pin to a post", ~m(community post)a do
      {:ok, _} = CMS.Articles.pin(community, post)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, post)
      assert {:error, _} = ORM.find_by(PinnedArticle, %{post_id: post.id})
    end
  end
end
