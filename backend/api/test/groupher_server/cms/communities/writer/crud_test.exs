defmodule GroupherServer.Test.CMS.Communities.Writer do
  @moduledoc false
  use GroupherServer.TestMate

  alias GroupherServer.Repo

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

    test "create community replays the canonical row for the same command id", ~m(user)a do
      command_id = Ecto.UUID.generate()
      community_attrs = mock_attrs(:community)

      assert {:ok, first} = CMS.Communities.create(community_attrs, user, command_id)
      assert {:ok, replayed} = CMS.Communities.create(community_attrs, user, command_id)
      assert replayed.id == first.id
      assert replayed.slug == first.slug
    end

    test "create community should reject invalid slug format", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "Invalid Slug"})

      assert {:error, %Ecto.Changeset{}} = CMS.Communities.create(community_attrs, user)
    end

    test "requesting community destruction archives the community", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, _} =
        CMS.Communities.request_destroy(community.slug, operation_ref: Ecto.UUID.generate())

      assert {:ok, _} = ORM.find(Community, community.id)

      assert Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: community.id).state ==
               :archived
    end

    test "requesting community destruction keeps related articles for recovery", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post2} = CMS.Articles.create(community, :post, post_attrs, user)

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      assert Repo.get!(CMS.Model.Article, post.id)
      assert Repo.get!(CMS.Model.Article, post2.id)
      assert Repo.get!(CMS.Model.Article, changelog.id)
      assert Repo.get!(CMS.Model.Article, blog.id)

      {:ok, _} =
        CMS.Communities.request_destroy(community.slug, operation_ref: Ecto.UUID.generate())

      {:ok, _} = ORM.find(Community, community.id)
      assert Repo.get!(CMS.Model.Article, post.id)
      assert Repo.get!(CMS.Model.Article, post2.id)
      assert Repo.get!(CMS.Model.Article, changelog.id)
      assert Repo.get!(CMS.Model.Article, blog.id)
    end

    test "archiving a community does not delete a mirrored post", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      community2_attrs = mock_attrs(:community, %{slug: "ts"})

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} =
        CMS.Articles.mirror(community2, post.id, [], user, community, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Communities.request_destroy(community.slug, operation_ref: Ecto.UUID.generate())

      {:ok, _} = ORM.find(Community, community.id)
      assert Repo.get!(CMS.Model.Article, post.id)
    end

    test "archiving a mirrored community keeps the post in the source community",
         ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      community2_attrs = mock_attrs(:community, %{slug: "ts"})

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} =
        CMS.Articles.mirror(community2, post.id, [], user, community, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Communities.request_destroy(community2.slug, operation_ref: Ecto.UUID.generate())

      {:ok, _} = ORM.find(Community, community2.id)

      assert Repo.get!(CMS.Model.Article, post.id)
    end
  end
end
