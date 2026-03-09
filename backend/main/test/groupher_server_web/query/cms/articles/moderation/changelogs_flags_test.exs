defmodule GroupherServer.Test.Query.Flags.ChangelogsFlags do
  @moduledoc false

  use GroupherServer.TestMate

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    changelogs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} =
          CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)
        acc ++ [value]
      end)

    changelog_b = changelogs |> List.first()
    changelog_m = changelogs |> Enum.at(div(@total_count, 2))
    changelog_e = changelogs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user changelog_b changelog_m changelog_e)a}
  end

  describe "[pending changelogs flags]" do
    test "pending changelog should not see in paged query",
         ~m(guest_conn community changelog_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.Articles.set_illegal(:changelog, changelog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, changelog_m} = CMS.FrontDesk.article(community, :changelog, changelog_m.inner_id)
      assert changelog_m.pending == @audit_illegal

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned changelogs flags]" do
    test "if have pinned changelogs, the pinned changelogs should at the top of entries",
         ~m(guest_conn community changelog_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.Articles.pin(community, changelog_m)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["innerId"] == to_string(changelog_m.inner_id)
      assert entries_first["isPinned"] == true
    end

    test "pinned changelogs should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, changelog} = CMS.FrontDesk.article(community, :changelog, random_id)
      {:ok, _} = CMS.Articles.pin(community, changelog)
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    test "if have trashed changelogs, the mark deleted changelogs should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("innerId")
      {:ok, random_changelog} = CMS.FrontDesk.article(community, :changelog, random_id)
      {:ok, _} = CMS.Articles.mark_delete(random_changelog)

      results = guest_conn |> gq_query(Schema.q(:paged_articles, :changelog), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
