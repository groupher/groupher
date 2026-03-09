defmodule GroupherServer.Test.Seeds.CommunitiesTest do
  @moduledoc false
  use GroupherServer.TestMate
  @moduletag timeout: 300_000

  alias GroupherServer.CMS.Seeds.Communities

  describe "[communities seeds]" do
    test "mock creates community with full default threads" do
      slug = "seed-community-#{System.unique_integer([:positive, :monotonic])}"

      {:ok, community} = Communities.mock(slug)
      {:ok, community} = ORM.find(Community, community.id, preload: [:dashboard, threads: :thread])

      thread_slugs = Enum.map(community.threads, & &1.thread.slug)

      assert Enum.all?(["post", "changelog", "kanban", "doc", "about"], &(&1 in thread_slugs))
      assert community.dashboard.enable.about == true
    end
  end
end
