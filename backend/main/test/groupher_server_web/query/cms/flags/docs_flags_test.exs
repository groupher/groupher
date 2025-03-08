defmodule GroupherServer.Test.Query.Flags.DocsFlags do
  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias Helper.{Constant, ORM}

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, community2} = db_insert(:community)
    CMS.create_article(community2, :doc, mock_attrs(:doc), user)

    docs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.create_article(community, :doc, mock_attrs(:doc), user)
        acc ++ [value]
      end)

    doc_b = docs |> List.first()
    doc_m = docs |> Enum.at(div(@total_count, 2))
    doc_e = docs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user doc_b doc_m doc_e)a}
  end

  describe "[pending docs flags]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          pending
          communities {
            slug
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "pending doc should not see in paged query",
         ~m(guest_conn community doc_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.set_article_illegal(:doc, doc_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, doc_m} = ORM.find(CMS.Model.Doc, doc_m.id)
      assert doc_m.pending == @audit_illegal

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned docs flags]" do
    @query """
    query($filter: PagedDocsFilter!) {
      pagedDocs(filter: $filter) {
        entries {
          id
          isPinned
          communities {
            slug
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "if have pinned docs, the pinned docs should at the top of entries",
         ~m(guest_conn community doc_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.pin_article(:doc, doc_m.id, community.id)

      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["id"] == to_string(doc_m.id)
      assert entries_first["isPinned"] == true
    end

    test "pind docs should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")

      {:ok, _} = CMS.pin_article(:doc, random_id, community.id)

      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "if have trashed docs, the mark deleted docs should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")
      {:ok, _} = CMS.mark_delete_article(:doc, random_id)

      results = guest_conn |> query_result(@query, variables, "pagedDocs")

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
