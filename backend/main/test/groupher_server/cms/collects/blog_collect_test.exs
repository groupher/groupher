defmodule GroupherServer.Test.Collect.Blog do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {_, blog, _, user} = mock_article(:blog)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 blog)a}
  end

  describe "[cms blog collect]" do
    test "blog can be collect && collects_count should inc by 1", ~m(user user2 blog)a do
      {:ok, article_collect} = CMS.collect_article(blog, user)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)

      assert article.id == blog.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.collect_article(blog, user2)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)

      assert article.collects_count == 2
    end

    test "blog can be undo collect && collects_count should dec by 1", ~m(user blog)a do
      {:ok, _} = CMS.collect_article(blog, user)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.collects_count == 1

      {:ok, _} = CMS.undo_collect_article(blog, user)
      {:ok, article} = ORM.find(Blog, blog.id)

      assert article.collects_count == 0
    end

    test "can get collect_users", ~m(user user2 blog)a do
      {:ok, _} = CMS.collect_article(blog, user)
      {:ok, _} = CMS.collect_article(blog, user2)

      {:ok, users} = CMS.collected_users(blog, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "blog meta history should be updated", ~m(user user2 blog)a do
      {:ok, _} = CMS.collect_article(blog, user)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert user.id in blog.meta.collected_user_ids

      {:ok, _} = CMS.collect_article(blog, user2)
      {:ok, blog} = ORM.find(Blog, blog.id)

      assert user.id in blog.meta.collected_user_ids
      assert user2.id in blog.meta.collected_user_ids
    end

    test "blog meta history should be updated after undo collect", ~m(user user2 blog)a do
      {:ok, _} = CMS.collect_article(blog, user)
      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, _} = CMS.collect_article(blog, user2)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert user.id in blog.meta.collected_user_ids
      assert user2.id in blog.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(blog, user2)
      {:ok, blog} = ORM.find(Blog, blog.id)

      assert user2.id not in blog.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(blog, user)
      {:ok, blog} = ORM.find(Blog, blog.id)

      assert user.id not in blog.meta.collected_user_ids
      assert user2.id not in blog.meta.collected_user_ids
    end

    test "undo collect without record is no-op", ~m(user blog)a do
      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.collects_count == 0

      {:ok, _} = CMS.undo_collect_article(blog, user)
      {:ok, blog} = ORM.find(Blog, blog.id)

      assert blog.collects_count == 0
    end
  end
end
