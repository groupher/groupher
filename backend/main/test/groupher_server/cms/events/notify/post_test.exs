defmodule GroupherServer.Test.CMS.Events.Notify.PostTest do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Events
  alias GroupherServer.Messaging

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    {:ok, ~m(user2 user3 community post comment)a}
  end

  describe "[upvote notify]" do
    test "upvote hook should work on post", ~m(user2 post)a do
      {:ok, post} = preload_author(post)

      {:ok, article} = CMS.Articles.upvote(post, user2)
      Events.emit(:notify_upvote, %{target: article, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, post.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == post.id
      assert notify.thread == "POST"
      assert notify.user_id == post.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "upvote hook should work on post comment", ~m(user2 post comment)a do
      {:ok, comment} = CMS.Comments.upvote_comment(comment.id, user2)
      {:ok, comment} = preload_author(comment)

      Events.emit(:notify_upvote, %{target: comment, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == post.id
      assert notify.thread == "POST"
      assert notify.user_id == comment.author.id
      assert notify.comment_id == comment.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo upvote hook should work on post", ~m(user2 post)a do
      {:ok, post} = preload_author(post)

      {:ok, article} = CMS.Articles.upvote(post, user2)
      Events.emit(:notify_upvote, %{target: article, from_user: user2})

      {:ok, article} = CMS.Articles.undo_upvote(post, user2)
      Events.emit(:notify_undo_upvote, %{target: article, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, post.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end

    test "undo upvote hook should work on post comment", ~m(user2 comment)a do
      {:ok, comment} = CMS.Comments.upvote_comment(comment.id, user2)

      Events.emit(:notify_upvote, %{target: comment, from_user: user2})

      {:ok, comment} = CMS.Comments.undo_upvote_comment(comment.id, user2)
      Events.emit(:notify_undo_upvote, %{target: comment, from_user: user2})

      {:ok, comment} = preload_author(comment)

      {:ok, notifications} = Messaging.paged_messages(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[collect notify]" do
    test "collect hook should work on post", ~m(user2 post)a do
      {:ok, post} = preload_author(post)

      {:ok, _} = CMS.Articles.collect(post, user2)
      Events.emit(:notify_collect, %{article: post, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, post.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COLLECT"
      assert notify.article_id == post.id
      assert notify.thread == "POST"
      assert notify.user_id == post.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo collect hook should work on post", ~m(user2 post)a do
      {:ok, post} = preload_author(post)

      {:ok, _} = CMS.Articles.upvote(post, user2)
      Events.emit(:notify_collect, %{article: post, from_user: user2})

      {:ok, _} = CMS.Articles.undo_upvote(post, user2)
      Events.emit(:notify_undo_collect, %{article: post, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, post.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[comment notify]" do
    test "post author should get notify after some one comment on it",
         ~m(user2 community post)a do
      {:ok, post} = preload_author(post)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user2)

      Events.emit(:notify_comment, %{comment: comment, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, post.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COMMENT"
      assert notify.thread == "POST"
      assert notify.article_id == post.id
      assert notify.user_id == post.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "post comment author should get notify after some one reply it",
         ~m(user2 user3 community post)a do
      {:ok, post} = preload_author(post)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user2)

      {:ok, replied_comment} = CMS.Comments.reply_comment(comment.id, mock_comment(), user3)

      Events.emit(:notify_reply, %{reply_comment: replied_comment, from_user: user3})

      comment = Repo.preload(comment, :author)
      {:ok, notifications} = Messaging.paged_messages(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()

      assert notify.action == "REPLY"
      assert notify.thread == "POST"
      assert notify.article_id == post.id
      assert notify.comment_id == replied_comment.id

      assert notify.user_id == comment.author_id
      assert user_exist_in?(user3, notify.from_users)
    end
  end
end
