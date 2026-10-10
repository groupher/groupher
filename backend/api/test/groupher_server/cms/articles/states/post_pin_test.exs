defmodule GroupherServer.Test.CMS.Articles.PostPin do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat
  alias CMS.Model.{ArticleBinding, PinnedArticle}

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

    {:ok, ~m(user community post)a}
  end

  describe "[cms post pin]" do
    test "can pin a post", ~m(community post user)a do
      command_id = Ecto.UUID.generate()
      {:ok, pinned_article} = CMS.Articles.pin(community, post.id, user, command_id)
      assert {:ok, replayed} = CMS.Articles.pin(community, post.id, user, command_id)
      assert replayed.id == pinned_article.id

      binding = Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)

      assert Repo.get_by!(PinnedArticle, article_binding_id: binding.id).article_binding_id ==
               binding.id

      assert pinned_article.id == post.id
    end

    test "one community & thread can only pin certain count of post", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
        {:ok, _} = CMS.Articles.pin(community, new_post.id, user, Ecto.UUID.generate())
        acc
      end)

      {:ok, new_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
      {:error, reason} = CMS.Articles.pin(community, new_post.id, user, Ecto.UUID.generate())

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.too_much_pinned_article())
    end

    test "can undo pin to a post", ~m(community post user)a do
      {:ok, _pin} = CMS.Articles.pin(community, post.id, user, Ecto.UUID.generate())
      command_id = Ecto.UUID.generate()

      assert {:ok, _unpinned} =
               CMS.Articles.undo_pin(community, post.id, user, command_id)

      assert {:ok, :done} = CMS.Articles.undo_pin(community, post.id, user, command_id)

      binding = Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
      refute Repo.get_by(PinnedArticle, article_binding_id: binding.id)
    end
  end
end
