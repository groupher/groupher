defmodule GroupherServer.Test.Seeds.CleanUpTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS.Seeds

  describe "[clean up]" do
    test "can clean up a community" do
      # {:ok, community} = Seeds.community(:home)
      # {:ok, _} = CMS.create_article(community, :post, post_attrs, user)

      # {:ok, found} = ORM.find_all(CommunityTag, %{page: 1, size: 20})
      # assert found.total_count === 0

      # Seeds.clean_up_community(:home)

      # {:ok, found} = ORM.find_all(Post, %{page: 1, size: 20})
      # assert found.total_count == 0

      # {:ok, found} = ORM.find_all(CommunityThread, %{page: 1, size: 20})
      # assert found.total_count == 0

      # {:ok, found} = ORM.find_all(Thread, %{page: 1, size: 20})
      # assert found.total_count !== 0

      # {:ok, found} = ORM.find_all(CommunityTag, %{page: 1, size: 20})
      # assert found.total_count == 0
    end
  end

  describe "[clean_up_articles]" do
    test "can clean up articles for a community" do
      # Test cleaning up articles of a specific type
      # {:ok, community} = Seeds.community(:home)
      # Seeds.articles(community, :post, 5)
      # Seeds.clean_up_articles(community, :post)
      # Verify articles are deleted
    end
  end
end
