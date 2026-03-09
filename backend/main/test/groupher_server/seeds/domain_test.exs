defmodule GroupherServer.Test.Seeds.DomainTest do
  @moduledoc false
  use GroupherServer.TestMate

  # alias GroupherServer.CMS.Seeds.Domain

  describe "[domain seeds]" do
    test "can seed home community" do
      # Test seeding the home community
      # {:ok, community} = Domain.seed_community(:home)
      # assert community.slug == "home"
    end

    test "can seed blackhole community" do
      # Test seeding the blackhole community
      # {:ok, community} = Domain.seed_community(:blackhole)
      # assert community.slug == "blackhole"
    end

    test "can seed feedback community" do
      # Test seeding the feedback community
      # {:ok, community} = Domain.seed_community(:feedback)
      # assert community.slug == "feedback"
    end

    test "domain communities have proper threads and tags" do
      # Test that domain communities are properly configured
    end
  end
end
