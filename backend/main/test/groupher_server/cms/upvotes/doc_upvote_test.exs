defmodule GroupherServer.Test.Upvotes.DocUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {_, doc, _, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 doc)a}
  end

  describe "[cms doc upvote]" do
    test "doc can be upvote && upvotes_count should inc by 1", ~m(user user2 doc)a do
      {:ok, article} = CMS.upvote_article(doc, user)
      assert article.id == doc.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.upvote_article(doc, user2)
      assert article.upvotes_count == 2
    end

    test "upvote a already upvoted doc is fine", ~m(user doc)a do
      {:ok, article} = CMS.upvote_article(doc, user)
      {:error, _error} = CMS.upvote_article(doc, user)

      assert article.upvotes_count == 1
    end

    test "doc can be undo upvote && upvotes_count should dec by 1", ~m(user user2 doc)a do
      {:ok, article} = CMS.upvote_article(doc, user)
      assert article.id == doc.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.undo_upvote_article(doc, user2)
      assert article.upvotes_count == 0
    end

    test "can get upvotes_users", ~m(user user2 doc)a do
      {:ok, _article} = CMS.upvote_article(doc, user)
      {:ok, _article} = CMS.upvote_article(doc, user2)

      {:ok, users} = CMS.upvoted_users(doc, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "doc meta history should be updated after upvote", ~m(user user2 doc)a do
      {:ok, article} = CMS.upvote_article(doc, user)
      assert user.id in article.meta.upvoted_user_ids

      {:ok, article} = CMS.upvote_article(doc, user2)

      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user.id in doc.meta.upvoted_user_ids
      assert user2.id in doc.meta.upvoted_user_ids
    end

    test "doc meta history should be updated after undo upvote", ~m(user user2 doc)a do
      {:ok, _} = CMS.upvote_article(doc, user)
      {:ok, _} = CMS.upvote_article(doc, user2)

      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user.id in doc.meta.upvoted_user_ids
      assert user2.id in doc.meta.upvoted_user_ids

      {:ok, _} = CMS.undo_upvote_article(doc, user2)
      {:ok, _} = CMS.undo_upvote_article(doc, user)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert user2.id not in doc.meta.upvoted_user_ids
      assert user.id not in doc.meta.upvoted_user_ids
    end
  end
end
