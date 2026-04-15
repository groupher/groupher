defmodule GroupherServer.Test.CMS.Events.Notify.ChangelogTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Events
  alias GroupherServer.{Messaging, Repo}

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :changelog, changelog.inner_id, mock_comment(), user)

    {:ok, ~m(user2 user3 community changelog comment)a}
  end

  describe "[upvote notify]" do
    test "upvote hook should work on changelog", ~m(user2 changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, article} = CMS.Articles.upvote(changelog, user2)
      Events.emit(:notify_upvote, %{target: article, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, changelog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == changelog.id
      assert notify.thread == :changelog
      assert notify.user_id == changelog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "upvote hook should work on changelog comment", ~m(user2 changelog comment)a do
      {:ok, comment} = CMS.Comments.upvote_comment(comment.id, user2)
      {:ok, comment} = preload_author(comment)

      Events.emit(:notify_upvote, %{target: comment, from_user: user2})

      {:ok, notifications} = Messaging.paged_messages(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == changelog.id
      assert notify.thread == :changelog
      assert notify.user_id == comment.author.id
      assert notify.comment_id == comment.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo upvote hook should work on changelog", ~m(user2 changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, article} = CMS.Articles.upvote(changelog, user2)
      Events.emit(:notify_upvote, %{target: article, from_user: user2})

      {:ok, article} = CMS.Articles.undo_upvote(changelog, user2)
      Events.emit(:notify_undo_upvote, %{target: article, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, changelog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end

    test "undo upvote hook should work on changelog comment", ~m(user2 comment)a do
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
    test "collect hook should work on changelog", ~m(user2 changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, _} = CMS.Articles.collect(changelog, user2)
      Events.emit(:notify_collect, %{article: changelog, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, changelog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COLLECT"
      assert notify.article_id == changelog.id
      assert notify.thread == :changelog
      assert notify.user_id == changelog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo collect hook should work on changelog", ~m(user2 changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, _} = CMS.Articles.collect(changelog, user2)
      Events.emit(:notify_collect, %{article: changelog, from_user: user2})

      {:ok, _} = CMS.Articles.undo_collect(changelog, user2)
      Events.emit(:notify_undo_collect, %{article: changelog, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, changelog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[comment notify]" do
    test "changelog author should get notify after some one comment on it",
         ~m(user2 community changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :changelog,
          changelog.inner_id,
          mock_comment(),
          user2
        )

      Events.emit(:notify_comment, %{comment: comment, from_user: user2})

      {:ok, notifications} =
        Messaging.paged_messages(:notification, changelog.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COMMENT"
      assert notify.thread == :changelog
      assert notify.article_id == changelog.id
      assert notify.user_id == changelog.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "changelog comment author should get notify after some one reply it",
         ~m(user2 user3 community changelog)a do
      {:ok, changelog} = preload_author(changelog)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :changelog,
          changelog.inner_id,
          mock_comment(),
          user2
        )

      {:ok, replied_comment} = CMS.Comments.reply_comment(comment.id, mock_comment(), user3)

      Events.emit(:notify_reply, %{reply_comment: replied_comment, from_user: user3})

      comment = Repo.preload(comment, :author)
      {:ok, notifications} = Messaging.paged_messages(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()

      assert notify.action == "REPLY"
      assert notify.thread == :changelog
      assert notify.article_id == changelog.id
      assert notify.comment_id == replied_comment.id

      assert notify.user_id == comment.author_id
      assert user_exist_in?(user3, notify.from_users)
    end
  end
end
