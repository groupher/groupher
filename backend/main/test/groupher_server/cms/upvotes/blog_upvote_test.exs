defmodule GroupherServer.Test.Upvotes.BlogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community blog)a}
  end

  describe "[cms blog upvote]" do
    @tag :wip
    test "blog can be upvote && upvotes_count should inc by 1",
         ~m(user user2 community blog)a do
      {:ok, article} = CMS.upvote_article(blog, user)
      assert article.id == blog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.upvote_article(blog, user2)
      assert article.upvotes_count == 2
    end

    @tag :wip
    test "upvote a already upvoted blog is fine", ~m(user community blog)a do
      {:ok, article} = CMS.upvote_article(blog, user)
      {:error, _error} = CMS.upvote_article(blog, user)

      assert article.upvotes_count == 1
    end

    @tag :wip
    test "blog can be undo upvote && upvotes_count should dec by 1",
         ~m(user user2 community blog)a do
      {:ok, article} = CMS.upvote_article(blog, user)
      assert article.id == blog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.undo_upvote_article(blog, user2)
      assert article.upvotes_count == 0
    end

    @tag :wip
    test "can get upvotes_users", ~m(user user2 community blog)a do
      {:ok, _article} = CMS.upvote_article(blog, user)
      {:ok, _article} = CMS.upvote_article(blog, user2)

      {:ok, users} = CMS.upvoted_users(blog, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    @tag :wip
    test "blog meta history should be updated after upvote",
         ~m(user user2 community blog)a do
      {:ok, article} = CMS.upvote_article(blog, user)
      assert user.id in article.meta.upvoted_user_ids

      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, article} = CMS.upvote_article(blog, user2)

      {:ok, blog} = ORM.find(Blog, blog.id)

      assert user.id in blog.meta.upvoted_user_ids
      assert user2.id in blog.meta.upvoted_user_ids
    end

    @tag :wip
    test "blog meta history should be updated after undo upvote",
         ~m(user user2 community blog)a do
      {:ok, _} = CMS.upvote_article(blog, user)
      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, _} = CMS.upvote_article(blog, user2)

      {:ok, blog} = ORM.find(Blog, blog.id)

      assert user.id in blog.meta.upvoted_user_ids
      assert user2.id in blog.meta.upvoted_user_ids

      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, _} = CMS.undo_upvote_article(blog, user2)
      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, _} = CMS.undo_upvote_article(blog, user)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert user2.id not in blog.meta.upvoted_user_ids
      assert user.id not in blog.meta.upvoted_user_ids
    end
  end
end
