defmodule GroupherServer.Test.Query.Flags.ChangelogsFlags do
  @moduledoc false

  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias Helper.{Constant, ORM}

  @total_count 35
  @page_size get_config(:general, :page_size)

  @audit_illegal Constant.CMS.pending(:illegal)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    changelogs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
        acc ++ [value]
      end)

    changelog_b = changelogs |> List.first()
    changelog_m = changelogs |> Enum.at(div(@total_count, 2))
    changelog_e = changelogs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user changelog_b changelog_m changelog_e)a}
  end

  describe "[pending changelogs flags]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
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
    @tag :wip2
    test "pending changelog should not see in paged query",
         ~m(guest_conn community changelog_m)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results["totalCount"] == @total_count

      {:ok, _} =
        CMS.set_article_illegal(:changelog, changelog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, changelog_m} = ORM.find(CMS.Model.Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_illegal

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      assert results["totalCount"] == @total_count - 1
    end
  end

  describe "[pinned changelogs flags]" do
    @query """
    query($filter: PagedChangelogsFilter!) {
      pagedChangelogs(filter: $filter) {
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
    @tag :wip2
    test "if have pinned changelogs, the pinned changelogs should at the top of entries",
         ~m(guest_conn community changelog_m)a do
      variables = %{filter: %{community: community.slug}}

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results |> is_valid_pagination?
      assert results["pageSize"] == @page_size
      assert results["totalCount"] == @total_count

      {:ok, _} = CMS.pin_article(:changelog, changelog_m.id, community.id)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      entries_first = results["entries"] |> List.first()

      assert results["totalCount"] == @total_count
      assert entries_first["id"] == to_string(changelog_m.id)
      assert entries_first["isPinned"] == true
    end

    @tag :wip2
    test "pinned changelogs should not appear when page > 1", ~m(guest_conn community)a do
      variables = %{filter: %{page: 2, size: 20}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")
      assert results |> is_valid_pagination?

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")

      {:ok, _} = CMS.pin_article(:changelog, random_id, community.id)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
    end

    @tag :wip2
    test "if have trashed changelogs, the mark deleted changelogs should not appears in result",
         ~m(guest_conn community)a do
      variables = %{filter: %{community: community.slug}}
      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      random_id = results["entries"] |> Enum.shuffle() |> List.first() |> Map.get("id")
      {:ok, _} = CMS.mark_delete_article(:changelog, random_id)

      results = guest_conn |> query_result(@query, variables, "pagedChangelogs")

      assert results["entries"] |> Enum.any?(&(&1["id"] !== random_id))
      assert results["totalCount"] == @total_count - 1
    end
  end
end
