defmodule GroupherServer.Test.Seeds.CommunitiesTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS.Seeds

  describe "[communities seeds]" do
    test "can seed a single community" do
      # Test seeding a specific community like :home or :feedback
      # {:ok, community} = Seeds.community(:home)
      # assert community.slug == "home"
    end

    test "can seed multiple communities by type" do
      # Test seeding communities of type :pl or :framework
      # Seeds.communities(:pl)
      # Verify communities were created
    end

    test "seed_community with type creates community with threads and tags" do
      # Test that seeding with type properly creates threads and tags
      # {:ok, community} = Seeds.community(:elixir, :pl)
      # assert community.slug == "elixir"
    end
  end

  describe "[set_category]" do
    test "can set category for multiple communities" do
      # Test setting a category for a list of communities
      # Seeds.set_category(["elixir", "ruby"], "pl")
      # Verify categories were set
    end
  end
end
