defmodule GroupherServer.Test.CMS.Articles.PostList do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, _, post_attrs, user} = mock_article(:post)

    {:ok, ~m(community post_attrs user)a}
  end

  describe "[cms post list]" do
    test "can get paged posts", ~m(community post_attrs user)a do
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, paged_posts} = CMS.Articles.page(:post, %{page: 1, size: 20})

      assert paged_posts |> is_valid_pagination?(:raw)
      assert length(paged_posts.entries) >= 2
      assert Enum.all?(paged_posts.entries, &(&1.meta.thread == :post))
    end
  end
end
