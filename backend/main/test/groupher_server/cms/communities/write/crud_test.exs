defmodule GroupherServer.Test.CMS.Communities.Write do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, ~m(user)a}
  end

  describe "[cms community curd]" do
    test "new created community should have default locale", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)

      assert community.locale == "en"
    end

    test "create community should reject invalid slug format", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "Invalid Slug"})

      assert {:error, %Ecto.Changeset{}} = CMS.Communities.create(community_attrs, user)
    end

    test "deleted community should delete the community row", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} = CMS.Communities.delete(community.slug)

      assert {:error, _} = ORM.find(Community, community.id)
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
