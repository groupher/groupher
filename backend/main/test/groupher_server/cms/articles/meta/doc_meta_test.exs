defmodule GroupherServer.Test.CMS.DocMeta do
  @moduledoc false
  use GroupherServer.TestTools

  @default_article_meta Embeds.ArticleMeta.default_meta()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    {:ok, ~m(user community doc_attrs)a}
  end

  describe "[cms doc meta info]" do
    test "can get default meta info", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      {:ok, doc} = ORM.find_by(Doc, id: doc.id)
      meta = doc.meta |> Map.from_struct() |> Map.delete(:id)

      assert meta == @default_article_meta |> Map.merge(%{thread: "DOC"})
    end

    test "is_edited flag should set to true after doc updated",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      {:ok, doc} = ORM.find_by(Doc, id: doc.id)

      assert not doc.meta.is_edited

      {:ok, _} = CMS.Articles.update(doc, %{"title" => "new title"})
      {:ok, doc} = ORM.find_by(Doc, id: doc.id)

      assert doc.meta.is_edited
    end

    test "doc's lock/undo_lock article should work", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert not doc.meta.is_comment_locked

      {:ok, _} = CMS.lock_article_comments(doc)
      {:ok, doc} = ORM.find_by(Doc, id: doc.id)

      assert doc.meta.is_comment_locked

      {:ok, _} = CMS.undo_lock_article_comments(doc)
      {:ok, doc} = ORM.find_by(Doc, id: doc.id)

      assert not doc.meta.is_comment_locked
    end

    # TODO:
    # test "doc with image should have imageCount in meta" do
    # end

    # TODO:
    # test "doc with video should have imageCount in meta" do
    # end
  end
end
