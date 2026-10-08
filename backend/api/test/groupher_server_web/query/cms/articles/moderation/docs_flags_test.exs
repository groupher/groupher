defmodule GroupherServer.Test.Query.Flags.DocsFlags do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @total_count 35
  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    docs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)
        acc ++ [value]
      end)

    doc_b = docs |> List.first()
    doc_m = docs |> Enum.at(div(@total_count, 2))
    doc_e = docs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user doc_b doc_m doc_e)a}
  end

  describe "[pending docs flags]" do
    test "pending doc should not see in paged query",
         ~m(guest_conn community doc_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.Articles.set_illegal(
          doc_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"],
            branch_id: doc_m.branch_id
          },
          :operations,
          community: community
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: doc_m.article_id,
          branch_id: doc_m.branch_id
        )

      assert state.moderation_state == :illegal

      results = guest_conn |> gq_query(S.Article.q(:paged_articles, :doc), variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned docs flags]" do
    test "Doc pinning is rejected because Doc navigation is owned by DocTree",
         ~m(community doc_m user)a do
      assert {:error, :unsupported_for_doc} =
               CMS.Articles.pin(community, doc_m.article_id, user, Ecto.UUID.generate())
    end
  end
end
