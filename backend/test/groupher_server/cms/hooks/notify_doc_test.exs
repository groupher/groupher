defmodule GroupherServer.Test.CMS.Hooks.NotifyDoc do
  use GroupherServer.TestTools

  import GroupherServer.CMS.Delegate.Helper, only: [preload_author: 1]

  alias GroupherServer.{CMS, Delivery, Repo}
  alias CMS.Delegate.Hooks

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, community} = db_insert(:community)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})
    {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
    {:ok, comment} = CMS.create_comment(:doc, doc.id, mock_comment(), user)

    {:ok, ~m(user2 user3 doc comment)a}
  end

  describe "[upvote notify]" do
    test "upvote hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, article} = CMS.upvote_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:upvote, article, user2)

      {:ok, notifications} = Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "UPVOTE"
      assert notify.article_id == doc.id
      assert notify.thread == "DOC"
      assert notify.user_id == doc.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "upvote hook should work on doc comment", ~m(user2 doc comment)a do
      {:ok, comment} = CMS.upvote_comment(comment.id, user2)
      {:ok, comment} = preload_author(comment)

      Hooks.Notify.handle(:upvote, comment, user2)

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

      {:ok, article} = CMS.upvote_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:upvote, article, user2)

      {:ok, article} = CMS.undo_upvote_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:undo, :upvote, article, user2)

      {:ok, notifications} = Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end

    test "undo upvote hook should work on doc comment", ~m(user2 comment)a do
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
    test "collect hook should work on doc", ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, _} = CMS.collect_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:collect, doc, user2)

      {:ok, notifications} = Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

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

      {:ok, _} = CMS.upvote_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:collect, doc, user2)

      {:ok, _} = CMS.undo_upvote_article(:doc, doc.id, user2)
      Hooks.Notify.handle(:undo, :collect, doc, user2)

      {:ok, notifications} = Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 0
    end
  end

  describe "[comment notify]" do
    test "doc author should get notify after some one comment on it",
         ~m(user2 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, comment} = CMS.create_comment(:doc, doc.id, mock_comment(), user2)
      Hooks.Notify.handle(:comment, comment, user2)

      {:ok, notifications} = Delivery.fetch(:notification, doc.author.user, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()
      assert notify.action == "COMMENT"
      assert notify.thread == "DOC"
      assert notify.article_id == doc.id
      assert notify.user_id == doc.author.user.id
      assert user_exist_in?(user2, notify.from_users)
    end

    test "doc comment author should get notify after some one reply it",
         ~m(user2 user3 doc)a do
      {:ok, doc} = preload_author(doc)

      {:ok, comment} = CMS.create_comment(:doc, doc.id, mock_comment(), user2)
      {:ok, replyed_comment} = CMS.reply_comment(comment.id, mock_comment(), user3)

      Hooks.Notify.handle(:reply, replyed_comment, user3)

      comment = Repo.preload(comment, :author)
      {:ok, notifications} = Delivery.fetch(:notification, comment.author, %{page: 1, size: 20})

      assert notifications.total_count == 1

      notify = notifications.entries |> List.first()

      assert notify.action == "REPLY"
      assert notify.thread == "DOC"
      assert notify.article_id == doc.id
      assert notify.comment_id == replyed_comment.id

      assert notify.user_id == comment.author_id
      assert user_exist_in?(user3, notify.from_users)
    end
  end
end
