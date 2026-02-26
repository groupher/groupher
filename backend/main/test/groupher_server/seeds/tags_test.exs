defmodule GroupherServer.Test.Seeds.TagsTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS.Seeds.{Communities, Tags}

  describe "[tags seeds]" do
    test "mock seeds tags for article threads" do
      slug = "seed-tags-#{System.unique_integer([:positive, :monotonic])}"
      {:ok, community} = Communities.mock(slug)

      {:ok, tag_ids} = Tags.mock(community, :post, count: 4)

      assert length(tag_ids) >= 4

      {:ok, paged_tags} =
        CMS.Communities.paged_tags(%{
          page: 1,
          size: 100,
          community_id: community.id,
          thread: "POST"
        })

      assert paged_tags.total_count >= 4
    end

    test "random_color returns valid color atom" do
      color = Tags.random_color()
      assert color in [:red, :orange, :yellow, :green, :cyan, :blue, :purple, :pink, :grey]
    end
  end
end
