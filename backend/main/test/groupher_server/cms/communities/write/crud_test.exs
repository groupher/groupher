defmodule GroupherServer.Test.CMS.Communities.Write do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Model.CommunityThread

  setup do
    {:ok, user} = db_insert(:user)
    
    {:ok, ~m(user)a}
  end

  describe "[cms community curd]" do
    test "new created community should have default threads & locale", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count == 5

      {:ok, community} = ORM.find(Community, community.id, preload: :threads)

      assert community.locale == "en"
      assert community.threads |> length == 5
    end

    test "deleted community should delete all related threads", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count !== 0

      {:ok, _} = CMS.Communities.delete(community.slug)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count == 0
    end

    test "deleted community should delete all related articles", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post2} = CMS.Articles.create(community, :post, post_attrs, user)

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, _} = ORM.find(Post, post.id)
      {:ok, _} = ORM.find(Post, post2.id)

      {:ok, _} = ORM.find(Changelog, changelog.id)
      {:ok, _} = ORM.find(Blog, blog.id)

      {:ok, _} = CMS.Communities.delete(community.slug)
      {:error, _} = ORM.find(Community, community.id)
      {:error, _} = ORM.find(Post, post.id)
      {:error, _} = ORM.find(Post, post2.id)

      {:error, _} = ORM.find(Changelog, changelog.id)
      {:error, _} = ORM.find(Blog, blog.id)
    end

    test "deleted community should delete post also belongs to other community", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      community2_attrs = mock_attrs(:community, %{slug: "ts"})

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.mirror(community2, post)

      {:ok, _} = CMS.Communities.delete(community.slug)
      {:error, _} = ORM.find(Community, community.id)

      {:error, _} = ORM.find(Post, post.id)
    end

    test "deleted community should not delete post when the mirrored community is deleted",
         ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      community2_attrs = mock_attrs(:community, %{slug: "ts"})

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.mirror(community2, post)

      {:ok, _} = CMS.Communities.delete(community2.slug)
      {:error, _} = ORM.find(Community, community2.id)

      {:ok, _} = ORM.find(Post, post.id)
    end
  end
end
