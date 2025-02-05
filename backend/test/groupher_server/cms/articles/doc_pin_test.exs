defmodule GroupherServer.Test.CMS.Artilces.DocPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS

  alias CMS.Model.{Community, PinnedArticle}

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

    {:ok, ~m(user community doc)a}
  end

  describe "[cms doc pin]" do
    test "can pin a doc", ~m(community doc)a do
      {:ok, _} = CMS.pin_article(:doc, doc.id, community.id)
      {:ok, pind_article} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})

      assert pind_article.doc_id == doc.id
    end

    test "one community & thread can only pin certern count of doc", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

        {:ok, _} = CMS.pin_article(:doc, new_doc.id, community.id)
        acc
      end)

      {:ok, new_doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

      {:error, reason} = CMS.pin_article(:doc, new_doc.id, community.id)
      assert reason |> Keyword.get(:code) == ecode(:too_much_pinned_article)
    end

    test "can not pin a non-exsit doc", ~m(community)a do
      assert {:error, _} = CMS.pin_article(:doc, 8848, community.id)
    end

    test "can undo pin to a doc", ~m(community doc)a do
      {:ok, _} = CMS.pin_article(:doc, doc.id, community.id)

      assert {:ok, _unpinned} = CMS.undo_pin_article(:doc, doc.id, community.id)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{doc_id: doc.id})
    end
  end
end
