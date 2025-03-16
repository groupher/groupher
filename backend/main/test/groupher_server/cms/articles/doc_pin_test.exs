defmodule GroupherServer.Test.CMS.Articles.DocPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

    {:ok, ~m(user community doc)a}
  end

  describe "[cms doc pin]" do
    @tag :wip
    test "can pin a doc", ~m(community doc)a do
      {:ok, _} = CMS.pin_article(community, doc)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})

      assert pinned_article.doc_id == doc.id
    end

    @tag :wip
    test "one community & thread can only pin certain count of doc", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

        {:ok, _} = CMS.pin_article(community, new_doc)
        acc
      end)

      {:ok, new_doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      {:error, reason} = CMS.pin_article(community, new_doc)
      assert reason |> Keyword.get(:code) == ecode(:too_much_pinned_article)
    end

    @tag :wip
    test "can undo pin to a doc", ~m(community doc)a do
      {:ok, _} = CMS.pin_article(community, doc)

      assert {:ok, _unpinned} = CMS.undo_pin_article(community, doc)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})
    end
  end
end
