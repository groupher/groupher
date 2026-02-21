defmodule GroupherServer.Test.Seeds.TagsTest do
  @moduledoc false
  use GroupherServer.TestTools

  # alias GroupherServer.CMS.Seeds.Tags
  # alias GroupherServer.CMS.Model.Community

  describe "[tags seeds]" do
    test "get returns tags for home post thread" do
      # Test getting tags for home community
      # tags = Tags.get(nil, :post, :home)
      # assert length(tags) > 0
    end

    test "get returns tags for home blog thread" do
      # tags = Tags.get(nil, :blog, :home)
      # assert length(tags) > 0
    end

    test "get returns tags for framework communities" do
      # Test getting tags for framework type
      # tags = Tags.get(nil, :post, :framework)
      # assert length(tags) > 0
    end

    test "get returns tags for city communities" do
      # tags = Tags.get(nil, :post, :city)
      # assert length(tags) > 0
    end

    test "get returns tags for specific community" do
      # Test getting tags for a specific community
      # community = %Community{slug: "blackhole"}
      # tags = Tags.get(community, :post)
      # assert length(tags) > 0
    end

    test "random_color returns valid color atom" do
      # color = Tags.random_color()
      # assert color in [:red, :orange, :yellow, :green, :cyan, :blue, :purple, :pink, :grey]
    end
  end
end
