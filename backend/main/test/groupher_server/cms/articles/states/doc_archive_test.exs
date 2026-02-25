defmodule GroupherServer.Test.CMS.DocArchive do
  @moduledoc false
  use GroupherServer.TestTools

  @archive_threshold get_config(:article, :archive_threshold)
  @doc_archive_threshold Timex.shift(
                           @now,
                           @archive_threshold[:doc] || @archive_threshold[:default]
                         )

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, doc_long_ago} = db_insert(:doc, %{title: "last week", inserted_at: @last_year})

    db_insert_multi(:doc, 5)

    {:ok, ~m(user community doc_long_ago)a}
  end

  describe "[cms doc archive]" do
    test "can archive docs", ~m(doc_long_ago)a do
      {:ok, _} = CMS.Articles.archive(:doc)

      archived_docs =
        Doc
        |> where([article], article.inserted_at < ^@doc_archive_threshold)
        |> Repo.all()

      assert length(archived_docs) == 1
      archived_doc = archived_docs |> List.first()
      assert archived_doc.id == doc_long_ago.id
    end

    test "can not edit archived doc" do
      {:ok, _} = CMS.Articles.archive(:doc)

      archived_docs =
        Doc
        |> where([article], article.inserted_at < ^@doc_archive_threshold)
        |> Repo.all()

      archived_doc = archived_docs |> List.first()
      {:error, reason} = CMS.Articles.update(archived_doc, %{"title" => "new title"})
      assert reason |> is_error?(:archived)
    end

    test "can not delete archived doc" do
      {:ok, _} = CMS.Articles.archive(:doc)

      archived_docs =
        Doc
        |> where([article], article.inserted_at < ^@doc_archive_threshold)
        |> Repo.all()

      archived_doc = archived_docs |> List.first()

      {:error, reason} = CMS.Articles.mark_delete(archived_doc)
      assert reason |> is_error?(:archived)
    end
  end
end
