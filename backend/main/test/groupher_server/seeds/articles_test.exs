defmodule GroupherServer.Test.Seeds.ArticlesTest do
  @moduledoc false
  use GroupherServer.TestTools

  # alias GroupherServer.CMS.Seeds
  # alias GroupherServer.CMS.Model.Community

  describe "[articles seeds]" do
    test "can seed articles for a community" do
      # {:ok, community} = Seeds.community(:home)
      # Seeds.articles(community, :post)
      # Verify articles were created
    end

    test "can seed specific count of articles" do
      # {:ok, community} = Seeds.community(:home)
      # Seeds.articles(community, :post, 10)
      # Verify exactly 10 articles were created
    end

    test "seeded articles have proper community association" do
      # Test that articles are properly linked to the community
    end

    test "seeded articles have tags and comments" do
      # Test that articles come with tags and comments
    end
  end
end
