defmodule GroupherServer.Test.CMS.Articles.DocPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

    {:ok, ~m(user community doc)a}
  end

  describe "[cms doc pin]" do
    test "can pin a doc", ~m(community doc)a do
      {:ok, _} = CMS.Articles.pin(community, doc)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})

      assert pinned_article.doc_id == doc.id
    end

    test "one community & thread can only pin certain count of doc", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

        {:ok, _} = CMS.Articles.pin(community, new_doc)
        acc
      end)

      {:ok, new_doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      {:error, reason} = CMS.Articles.pin(community, new_doc)
      assert error_code(reason) == ecode(:too_much_pinned_article)
    end

    test "can undo pin to a doc", ~m(community doc)a do
      {:ok, _} = CMS.Articles.pin(community, doc)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, doc)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})
    end
  end
end
