defmodule GroupherServer.Test.Seeds.LiteHomeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  @moduletag timeout: 300_000

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Seeds.LiteHome

  describe "[lite home seeds]" do
    test "resets home with minimal main and dashboard data" do
      {:ok, seeded_community} = LiteHome.reset_and_seed()
      {:ok, community} = ORM.find(Community, seeded_community.id, preload: :dashboard)

      assert community.slug == "home"
      assert community.dashboard.enable.post == true
      assert community.dashboard.enable.kanban == true
      assert community.dashboard.enable.changelog == true
      assert community.dashboard.enable.doc == false

      assert count(Post, community.id) == 4
      assert count(Changelog, community.id) == 3
      assert count(Doc, community.id) == 0
      assert seeded_community.seed_summary.kanban_posts == 4

      kanban_posts =
        Repo.all(
          from(p in Post,
            join: community in assoc(p, :communities),
            where: community.id == ^community.id and not is_nil(p.status)
          )
        )

      assert length(kanban_posts) == 4
      assert Enum.sort(Enum.map(kanban_posts, & &1.status)) == [:backlog, :done, :todo, :wip]

      assert {:ok, %{todo: %{entries: [_ | _]}}} = CMS.Articles.grouped_kanban(community)

      {1, _} =
        Post
        |> join(:inner, [post], community in assoc(post, :communities))
        |> where(
          [post, community],
          community.id == ^community.id and post.title == "一次线上故障复盘记录"
        )
        |> Repo.update_all(set: [status: nil])

      assert kanban_count(community.id) == 3

      {:ok, community} = LiteHome.seed()

      assert count(Post, community.id) == 4
      assert count(Changelog, community.id) == 3
      assert count(Doc, community.id) == 0
      assert count(Post, community.id) == community.seed_summary.posts
      assert kanban_count(community.id) == 4
      assert community.seed_summary.kanban_posts == 4
    end
  end

  defp kanban_count(community_id) do
    {:ok, total_count} =
      Post
      |> join(:inner, [post], community in assoc(post, :communities))
      |> where([post, community], community.id == ^community_id and not is_nil(post.status))
      |> ORM.count()

    total_count
  end

  defp count(schema, community_id) do
    {:ok, total_count} =
      schema
      |> join(:inner, [item], community in assoc(item, :communities))
      |> where([_item, community], community.id == ^community_id)
      |> ORM.count()

    total_count
  end
end
