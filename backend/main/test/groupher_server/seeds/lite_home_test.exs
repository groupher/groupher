defmodule GroupherServer.Test.Seeds.LiteHomeTest do
  @moduledoc false
  use GroupherServer.TestMate
  @moduletag timeout: 300_000

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Seeds.LiteHome

  describe "[lite home seeds]" do
    test "resets home with minimal main and dashboard data" do
      {:ok, community} = LiteHome.reset_and_seed()
      {:ok, community} = ORM.find(Community, community.id, preload: :dashboard)

      assert community.slug == "home"
      assert community.dashboard.enable.post == true
      assert community.dashboard.enable.kanban == true
      assert community.dashboard.enable.changelog == true
      assert community.dashboard.enable.doc == false

      assert count(Post, community.id) == 4
      assert count(Changelog, community.id) == 3
      assert count(Doc, community.id) == 0

      kanban_posts =
        Repo.all(from(p in Post, where: p.community_id == ^community.id and not is_nil(p.status)))

      assert length(kanban_posts) == 4
      assert Enum.sort(Enum.map(kanban_posts, & &1.status)) == [:backlog, :done, :todo, :wip]

      assert {:ok, %{todo: %{entries: [_ | _]}}} = CMS.Articles.grouped_kanban(community)
    end
  end

  defp count(schema, community_id) do
    {:ok, total_count} =
      schema
      |> where([item], item.community_id == ^community_id)
      |> ORM.count()

    total_count
  end
end
