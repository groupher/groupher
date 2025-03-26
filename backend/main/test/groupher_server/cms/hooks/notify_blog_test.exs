defmodule GroupherServer.Test.CMS.Hooks.NotifyBlog do
  @moduledoc false

  use GroupherServer.TestTools

  import Helper.Utils, only: [preload_author: 1]

  alias GroupherServer.Delivery
  alias CMS.Delegate.Hooks

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, comment} =
      CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

    {:ok, ~m(user2 user3 community blog comment)a}
  end

  describe "[upvote notify]" do
    test "upvote hook should work on blog", ~m(user2 blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, article} = CMS.upvote_article(blog, user2)
      Hooks.Notify.handle(:upvote, article, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, blog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == blog.id
      assert notify.thread == "BLOG"
      assert notify.user_id == blog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    @tag :wip
    test "upvote hook should work on blog comment", ~m(user2 blog comment)a do
      {:ok, comment} = CMS.upvote_comment(comment.id, user2)
      {:ok, comment} = preload_author(comment)

      Hooks.Notify.handle(:upvote, comment, user2)

      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == blog.id
      assert notify.thread == "BLOG"
      assert notify.user_id == comment.author.id
      assert notify.comment_id == comment.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo upvote hook should work on blog", ~m(user2 blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, article} = CMS.upvote_article(blog, user2)
      Hooks.Notify.handle(:upvote, article, user2)

      {:ok, article} = CMS.undo_upvote_article(blog, user2)
      Hooks.Notify.handle(:undo, :upvote, article, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, blog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end

    test "undo upvote hook should work on blog comment", ~m(user2 comment)a do
      {:ok, comment} = CMS.upvote_comment(comment.id, user2)

      Hooks.Notify.handle(:upvote, comment, user2)

      {:ok, comment} = CMS.undo_upvote_comment(comment.id, user2)
      Hooks.Notify.handle(:undo, :upvote, comment, user2)

      {:ok, comment} = preload_author(comment)

      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[collect notify]" do
    test "collect hook should work on blog", ~m(user2 blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, _} = CMS.collect_article(:blog, blog.id, user2)
      Hooks.Notify.handle(:collect, blog, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, blog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COLLECT"
      assert notify.article_id == blog.id
      assert notify.thread == "BLOG"
      assert notify.user_id == blog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo collect hook should work on blog", ~m(user2 blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, _} = CMS.upvote_article(blog, user2)
      Hooks.Notify.handle(:collect, blog, user2)

      {:ok, _} = CMS.undo_upvote_article(blog, user2)
      Hooks.Notify.handle(:undo, :collect, blog, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, blog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[comment notify]" do
    test "blog author should get notify after some one comment on it",
         ~m(user2 community blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user2)

      Hooks.Notify.handle(:comment, comment, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, blog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COMMENT"
      assert notify.thread == "BLOG"
      assert notify.article_id == blog.id
      assert notify.user_id == blog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "blog comment author should get notify after some one reply it",
         ~m(user2 user3 community blog)a do
      {:ok, blog} = preload_author(blog)

      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user2)

      {:ok, replied_comment} = CMS.reply_comment(comment.id, mock_comment(), user3)

      Hooks.Notify.handle(:reply, replied_comment, user3)

      comment = Repo.preload(comment, :author)
      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()

      assert notify.action == "REPLY"
      assert notify.thread == "BLOG"
      assert notify.article_id == blog.id
      assert notify.comment_id == replied_comment.id

      assert notify.user_id == comment.author_id
      assert user_exist_in?(user3, notify.from_users)
    end
  end
end
