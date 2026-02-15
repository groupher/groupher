defmodule GroupherServer.Test.Query.Flags.DocsFlags do
  @moduledoc false

  use GroupherServer.TestTools

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

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
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.Articles.set_illegal(:doc, doc_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, doc_m} = ORM.find_article(community, :doc, doc_m.inner_id)
      assert doc_m.pending == @audit_illegal

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned docs flags]" do
    test "if have pinned docs, the pinned docs should at the top of entries",
         ~m(guest_conn community doc_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.Articles.pin(community, doc_m)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["innerId"] == to_string(doc_m.inner_id)
      assert entries_first["isPinned"] == true
    end

    test "pinned docs should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, doc} = ORM.find_article(community, :doc, random_id)
      {:ok, _} = CMS.Articles.pin(community, doc)
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "if have trashed docs, the mark deleted docs should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, random_doc} = ORM.find_article(community, :doc, random_id)
      {:ok, _} = CMS.Articles.mark_delete(random_doc)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :doc), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
