defmodule GroupherServer.Test.Seeds.CommunitiesTest do
  @moduledoc false
  use GroupherServer.TestMate
  @moduletag timeout: 300_000
  @default_threads [:post, :changelog, :kanban, :doc, :about]

  alias GroupherServer.CMS.Seeds.Communities

  describe "[communities seeds]" do
    test "mock creates community with full default threads" do
      slug = "seed-community-#{System.unique_integer([:positive, :monotonic])}"

      {:ok, community} = Communities.mock(slug)
      {:ok, community} = ORM.find(Community, community.id, preload: :dashboard)

      assert Enum.all?(@default_threads, &Map.get(community.dashboard.enable, &1))
      assert community.dashboard.enable.about == true
    end
  end
end
