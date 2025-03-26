defmodule GroupherServer.Test.Collect.Post do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community post)a}
  end

  describe "[cms post collect]" do
    test "post can be collect && collects_count should inc by 1",
         ~m(user user2 community post)a do
      {:ok, article_collect} = CMS.collect_article(post, user)
      {:ok, article} = ORM.find(Post, article_collect.post_id)

      assert article.id == post.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.collect_article(post, user2)
      {:ok, article} = ORM.find(Post, article_collect.post_id)

      assert article.collects_count == 2
    end

    test "post can be undo collect && collects_count should dec by 1",
         ~m(user community post)a do
      {:ok, _} = CMS.collect_article(post, user)

      {:ok, post} = ORM.find(Post, post.id)
      assert post.collects_count == 1

      {:ok, _} = CMS.undo_collect_article(post, user)
      {:ok, article} = ORM.find(Post, post.id)

      assert article.collects_count == 0
    end

    test "can get collect_users", ~m(user user2 community post)a do
      {:ok, _} = CMS.collect_article(post, user)
      {:ok, _} = CMS.collect_article(post, user2)

      {:ok, users} = CMS.collected_users(post, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "post meta history should be updated", ~m(user user2 community post)a do
      {:ok, _} = CMS.collect_article(post, user)

      {:ok, post} = ORM.find(Post, post.id)
      assert user.id in post.meta.collected_user_ids

      {:ok, _} = CMS.collect_article(post, user2)
      {:ok, post} = ORM.find(Post, post.id)

      assert user.id in post.meta.collected_user_ids
      assert user2.id in post.meta.collected_user_ids
    end

    test "post meta history should be updated after undo collect",
         ~m(user user2 community post)a do
      {:ok, _} = CMS.collect_article(post, user)
      {:ok, post} = ORM.find(Post, post.id)
      {:ok, _} = CMS.collect_article(post, user2)

      {:ok, post} = ORM.find(Post, post.id)
      assert user.id in post.meta.collected_user_ids
      assert user2.id in post.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(post, user2)
      {:ok, post} = ORM.find(Post, post.id)

      assert user2.id not in post.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(post, user)
      {:ok, post} = ORM.find(Post, post.id)

      assert user.id not in post.meta.collected_user_ids
      assert user2.id not in post.meta.collected_user_ids
    end
  end
end
