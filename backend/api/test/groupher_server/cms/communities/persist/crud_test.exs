defmodule GroupherServer.Test.CMS.Communities.Persist do
  @moduledoc false
  use GroupherServer.TestMate

  import ExUnit.CaptureLog

  alias GroupherServer.Repo

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, ~m(user)a}
  end

  describe "[cms community curd]" do
    test "community creation skips optional web analysis provisioning in test", ~m(user)a do
      log =
        capture_log(fn ->
          assert {:ok, _community} =
                   CMS.Communities.create(
                     mock_attrs(:community),
                     user,
                     Ecto.UUID.generate()
                   )
        end)

      refute log =~ "Community web analysis provisioning deferred"
    end

    test "new created community should have default locale", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())

      {:ok, community} = ORM.find(Community, community.id)

      assert community.locale == "en"
    end

    test "community creation installs its review defaults in the same transaction", ~m(user)a do
      {:ok, community} =
        CMS.Communities.create(
          mock_attrs(:community, %{slug: "review-defaults"}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{system: system, community: community_config}} =
               GroupherServer.ReviewBot.configs_for_target(community.id, :article)

      assert system.community_id == nil
      assert community_config.community_id == community.id
      assert is_nil(system.review_mode)
      assert community_config.review_mode == :immediate

      assert {:ok, %{system: platform_doc_config, community: nil}} =
               GroupherServer.ReviewBot.configs_for_target(community.id, :doc)

      assert platform_doc_config.community_id == nil
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

      assert {:error, %Ecto.Changeset{}} =
               CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())
    end

    test "requesting community destruction archives the community", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Communities.request_destroy(community, user, command_id: Ecto.UUID.generate())

      assert {:ok, _} = ORM.find(Community, community.id)

      assert Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: community.id).state ==
               :archived
    end

    test "requesting community destruction keeps related articles for recovery", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())

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
        CMS.Communities.request_destroy(community, user, command_id: Ecto.UUID.generate())

      {:ok, _} = ORM.find(Community, community.id)
      assert Repo.get!(CMS.Model.Article, post.id)
      assert Repo.get!(CMS.Model.Article, post2.id)
      assert Repo.get!(CMS.Model.Article, changelog.id)
      assert Repo.get!(CMS.Model.Article, blog.id)
    end

    test "archiving a community does not delete a mirrored post", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir"})
      community2_attrs = mock_attrs(:community, %{slug: "ts"})

      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())
      {:ok, community2} = CMS.Communities.create(community2_attrs, user, Ecto.UUID.generate())
      user = grant_binding_actions(user, [community, community2])

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

      {:ok, community} = CMS.Communities.create(community_attrs, user, Ecto.UUID.generate())
      {:ok, community2} = CMS.Communities.create(community2_attrs, user, Ecto.UUID.generate())
      user = grant_binding_actions(user, [community, community2])

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} =
        CMS.Articles.mirror(community2, post.id, [], user, community, Ecto.UUID.generate())

      {:ok, _} =
        CMS.Communities.request_destroy(community2, user, command_id: Ecto.UUID.generate())

      {:ok, _} = ORM.find(Community, community2.id)

      assert Repo.get!(CMS.Model.Article, post.id)
    end
  end

  defp grant_binding_actions(user, communities) do
    grants =
      Enum.into(communities, %{}, fn community ->
        {community.slug, %{"cms" => %{"post.pin" => true}}}
      end)

    Map.put(
      user,
      :cur_passport,
      Map.merge(%{"global" => %{"post.community.mirror" => true}}, grants)
    )
  end
end
