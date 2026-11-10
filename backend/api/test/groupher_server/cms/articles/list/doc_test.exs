defmodule GroupherServer.Test.CMS.Articles.DocList do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, _, doc_attrs, user} = mock_article(:doc)

    {:ok, ~m(community doc_attrs user)a}
  end

  describe "[cms doc list]" do
    test "can get paged docs", ~m(community doc_attrs user)a do
      {:ok, _} =
        CMS.Articles.create(community, :doc, doc_attrs, user, command_id: Ecto.UUID.generate())

      {:ok, _} =
        CMS.Articles.create(community, :doc, doc_attrs, user, command_id: Ecto.UUID.generate())

      {:ok, paged_docs} =
        CMS.Articles.page(:doc, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})

      assert paged_docs |> is_map()
      assert length(paged_docs.entries) >= 2
      assert Enum.all?(paged_docs.entries, &(&1.thread == :doc))
    end
  end
end
