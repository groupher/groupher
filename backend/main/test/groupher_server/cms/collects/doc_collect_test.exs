defmodule GroupherServer.Test.Collect.Doc do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {_, doc, _, user} = mock_article(:doc)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 doc)a}
  end

  describe "[cms doc collect]" do
    test "doc can be collect && collects_count should inc by 1", ~m(user user2 doc)a do
      {:ok, article_collect} = CMS.collect_article(doc, user)
      {:ok, article} = ORM.find(Doc, article_collect.doc_id)

      assert article.id == doc.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.collect_article(doc, user2)
      {:ok, article} = ORM.find(Doc, article_collect.doc_id)

      assert article.collects_count == 2
    end

    test "doc can be undo collect && collects_count should dec by 1", ~m(user doc)a do
      {:ok, _} = CMS.collect_article(doc, user)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.collects_count == 1

      {:ok, _} = CMS.undo_collect_article(doc, user)
      {:ok, article} = ORM.find(Doc, doc.id)

      assert article.collects_count == 0
    end

    test "can get collect_users", ~m(user user2 doc)a do
      {:ok, _} = CMS.collect_article(doc, user)
      {:ok, _} = CMS.collect_article(doc, user2)

      {:ok, users} = CMS.collected_users(doc, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "doc meta history should be updated", ~m(user user2 doc)a do
      {:ok, _} = CMS.collect_article(doc, user)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert user.id in doc.meta.collected_user_ids

      {:ok, _} = CMS.collect_article(doc, user2)
      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user.id in doc.meta.collected_user_ids
      assert user2.id in doc.meta.collected_user_ids
    end

    test "doc meta history should be updated after undo collect", ~m(user user2 doc)a do
      {:ok, _} = CMS.collect_article(doc, user)
      {:ok, doc} = ORM.find(Doc, doc.id)
      {:ok, _} = CMS.collect_article(doc, user2)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert user.id in doc.meta.collected_user_ids
      assert user2.id in doc.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(doc, user2)
      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user2.id not in doc.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(doc, user)
      {:ok, doc} = ORM.find(Doc, doc.id)

      assert user.id not in doc.meta.collected_user_ids
      assert user2.id not in doc.meta.collected_user_ids
    end
  end
end
