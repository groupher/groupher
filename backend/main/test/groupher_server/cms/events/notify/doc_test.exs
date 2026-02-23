defmodule GroupherServer.Test.CMS.Events.Notify.DocTest do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.Delivery
  alias CMS.Events

  setup do
    {community, doc, _, user} = mock_article(:doc)

    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

    {:ok, ~m(user2 user3 community doc comment)a}
  end

  describe "[upvote notify]" do
    test "upvote hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, article} = CMS.Articles.upvote(doc, user2)
      Events.Notify.handle(:upvote, article, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == doc.id
      assert notify.thread == "DOC"
      assert notify.user_id == doc.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "upvote hook should work on doc comment", ~m(user2 doc comment)a do
      {:ok, comment} = CMS.Comments.upvote_comment(comment.id, user2)
      {:ok, comment} = preload_author(comment)

      Events.Notify.handle(:upvote, comment, user2)

      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == doc.id
      assert notify.thread == "DOC"
      assert notify.user_id == comment.author.id
      assert notify.comment_id == comment.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo upvote hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, article} = CMS.Articles.upvote(doc, user2)
      Events.Notify.handle(:upvote, article, user2)

      {:ok, article} = CMS.Articles.undo_upvote(doc, user2)
      Events.Notify.handle(:undo, :upvote, article, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end

    test "undo upvote hook should work on doc comment", ~m(user2 comment)a do
      {:ok, comment} = CMS.Comments.upvote_comment(comment.id, user2)

      Events.Notify.handle(:upvote, comment, user2)

      {:ok, comment} = CMS.Comments.undo_upvote_comment(comment.id, user2)
      Events.Notify.handle(:undo, :upvote, comment, user2)

      {:ok, comment} = preload_author(comment)

      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[collect notify]" do
    test "collect hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, _} = CMS.Articles.collect(doc, user2)
      Events.Notify.handle(:collect, doc, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COLLECT"
      assert notify.article_id == doc.id
      assert notify.thread == "DOC"
      assert notify.user_id == doc.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "undo collect hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, _} = CMS.Articles.collect(doc, user2)
      Events.Notify.handle(:collect, doc, user2)

      {:ok, _} = CMS.Articles.undo_collect(doc, user2)
      Events.Notify.handle(:undo, :collect, doc, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[comment notify]" do
    test "doc author should get notify after some one comment on it",
         ~m(user2 community doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user2)

      Events.Notify.handle(:comment, comment, user2)

      {:ok, notifications} =
        Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COMMENT"
      assert notify.thread == "DOC"
      assert notify.article_id == doc.id
      assert notify.user_id == doc.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "doc comment author should get notify after some one reply it",
         ~m(user2 user3 community doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user2)

      {:ok, replied_comment} = CMS.Comments.reply_comment(comment.id, mock_comment(), user3)

      Events.Notify.handle(:reply, replied_comment, user3)

      comment = Repo.preload(comment, :author)
      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()

      assert notify.action == "REPLY"
      assert notify.thread == "DOC"
      assert notify.article_id == doc.id
      assert notify.comment_id == replied_comment.id

      assert notify.user_id == comment.author_id
      assert user_exist_in?(user3, notify.from_users)
    end
  end
end
