defmodule GroupherServer.Test.CMS.Community do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Model.{Community, Post, Changelog, Blog, CommunityThread}

  alias Helper.{Constant, ORM}

  @community_normal Constant.CMS.pending(:normal)
  @community_applying Constant.CMS.pending(:applying)

  setup do
    {:ok, user} = db_insert(:user)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
    {:ok, community} = CMS.create_community(community_attrs)

    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    article_tag_attrs = mock_attrs(:article_tag)

    {:ok, ~m(user community article_tag_attrs user2 user3)a}
  end

  describe "[cms community curd]" do
    test "new created community should have default threads & locale", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir", user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count == 5

      {:ok, community} = ORM.find(Community, community.id, preload: :threads)

      assert community.locale == "en"
      assert community.threads |> length == 5
    end

    test "delated community should delete all related threads", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir", user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count !== 0

      {:ok, _} = CMS.delete_community(community.slug)

      {:ok, all_threads} =
        ORM.find_all(CommunityThread, %{page: 1, size: 20, community_id: community.id})

      assert all_threads.total_count == 0
    end

    test "delated community should delete all related articles", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir", user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, post2} = CMS.create_article(community, :post, post_attrs, user)

      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _} = ORM.find(Post, post.id)
      {:ok, _} = ORM.find(Post, post2.id)

      {:ok, _} = ORM.find(Changelog, changelog.id)
      {:ok, _} = ORM.find(Blog, blog.id)

      {:ok, _} = CMS.delete_community(community.slug)
      {:error, _} = ORM.find(Community, community.id)
      {:error, _} = ORM.find(Post, post.id)
      {:error, _} = ORM.find(Post, post2.id)

      {:error, _} = ORM.find(Changelog, changelog.id)
      {:error, _} = ORM.find(Blog, blog.id)
    end

    test "delated community should delete post also belongs to other community", ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir", user_id: user.id})
      community2_attrs = mock_attrs(:community, %{slug: "ts", user_id: user.id})

      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, community2} = CMS.create_community(community2_attrs)

      post_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

      {:ok, _} = CMS.mirror_article(:post, post.id, community2.id)

      {:ok, _} = CMS.delete_community(community.slug)
      {:error, _} = ORM.find(Community, community.id)

      {:error, _} = ORM.find(Post, post.id)
    end

    test "deleted community should not delete post when the mirrored community is deleted",
         ~m(user)a do
      community_attrs = mock_attrs(:community, %{slug: "elixir", user_id: user.id})
      community2_attrs = mock_attrs(:community, %{slug: "ts", user_id: user.id})

      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, community2} = CMS.create_community(community2_attrs)

      post_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

      {:ok, _} = CMS.mirror_article(:post, post.id, community2.id)

      {:ok, _} = CMS.delete_community(community2.slug)
      {:error, _} = ORM.find(Community, community2.id)

      {:ok, _} = ORM.find(Post, post.id)
    end
  end

  describe "[cms community apply]" do
    # test "apply a community should have pending and can not be read", ~m(user)a do
    #   attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id, apply_msg: "apply msg"})
    #   {:ok, community} = CMS.apply_community(attrs)

    #   assert community.meta.apply_msg == "apply msg"
    #   assert community.meta.apply_category == "PUBLIC"

    #   {:ok, community} = ORM.find(Community, community.id)
    #   assert community.pending == @community_applying
    #   assert {:error, _} = CMS.read_community(community.slug)

    #   {:ok, community} = CMS.approve_community_apply(community.slug)

    #   {:ok, community} = ORM.find(Community, community.id)
    #   assert community.pending == @community_normal
    #   assert {:ok, _} = CMS.read_community(community.slug)
    # end

    test "apply community can set root user by default", ~m(user)a do
      attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.apply_community(attrs)

      {:ok, community} = ORM.find(Community, community.id, preload: [moderators: :user])
      moderator_user = community.moderators |> Enum.at(0)

      assert moderator_user.user_id == user.id
    end

    test "apply can be deny", ~m(user)a do
      attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.apply_community(attrs)
      {:ok, community} = CMS.deny_community_apply(community.id)

      {:error, _} = ORM.find(Community, community.id)
    end

    test "user can query has pending apply or not", ~m(user user2)a do
      attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, _community} = CMS.apply_community(attrs)

      {:ok, state} = CMS.has_pending_community_apply?(user)
      assert state.exist

      {:ok, state} = CMS.has_pending_community_apply?(user2)
      assert not state.exist
    end
  end

  describe "[cms community read]" do
    test "read community should inc views", ~m(community)a do
      {:ok, community} = CMS.read_community(community.slug)
      assert community.views == 1
      {:ok, community} = CMS.read_community(community.slug)
      assert community.views == 2
      {:ok, community} = CMS.read_community(community.slug)
      assert community.views == 3
    end

    test "read community should not inc views if opt provide", ~m(community)a do
      {:ok, community} = CMS.read_community(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.read_community(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.read_community(community.slug, inc_views: false)
      assert community.views == 0
    end

    test "read subscribed community should have a flag", ~m(community user user2)a do
      {:ok, _} = CMS.subscribe_community(community, user)

      {:ok, community} = CMS.read_community(community.slug, user)

      assert community.viewer_has_subscribed
      assert user.id in community.meta.subscribed_user_ids

      {:ok, community} = CMS.read_community(community.slug, user2)
      assert not community.viewer_has_subscribed
      assert user2.id not in community.meta.subscribed_user_ids
    end

    test "read moderatorable community should have a flag", ~m(community user user2 user3)a do
      role = "moderator"
      cur_user = user
      {:ok, community} = CMS.add_moderator(community.slug, role, user2, cur_user)

      {:ok, community} = CMS.read_community(community.slug, user2)
      assert community.viewer_is_moderator

      {:ok, community} = CMS.read_community(community.slug, user3)
      assert not community.viewer_is_moderator

      {:ok, community} = CMS.remove_moderator(community.slug, user2, cur_user)
      {:ok, community} = CMS.read_community(community.slug, user2)

      assert not community.viewer_is_moderator
    end
  end

  describe "[cms community article_tag]" do
    test "articleTagsCount should work", ~m(community article_tag_attrs user)a do
      {:ok, tag} = CMS.create_article_tag(community, :post, article_tag_attrs, user)
      {:ok, tag2} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      {:ok, tag3} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.article_tags_count == 3

      {:ok, _} = CMS.delete_article_tag(tag.id)
      {:ok, _} = CMS.delete_article_tag(tag2.id)
      {:ok, _} = CMS.delete_article_tag(tag3.id)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.article_tags_count == 0
    end
  end

  describe "[cms community moderator]" do
    test "can add moderator to a community", ~m(user user2 community)a do
      cur_user = user

      role = "moderator"
      {:ok, community} = CMS.add_moderator(community.slug, role, user2, cur_user)

      assert community.moderators_count == 2
      assert user.id in community.meta.moderators_ids
      assert user2.id in community.meta.moderators_ids
    end

    test "can unset moderator to a community", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user

      {:ok, community} = CMS.add_moderator(community.slug, role, user2, cur_user)
      assert community.moderators_count == 2

      {:ok, community} = CMS.remove_moderator(community.slug, user2, cur_user)
      assert community.moderators_count == 1
      assert user2.id not in community.meta.moderators_ids
    end
  end

  describe "[cms community subscribe]" do
    test "user can subscribe a community", ~m(user community)a do
      {:ok, record} = CMS.subscribe_community(community, user)
      assert community.id == record.id
    end

    test "user subscribe a community will update the community's subscribted info",
         ~m(user community)a do
      assert community.subscribers_count == 0
      {:ok, _record} = CMS.subscribe_community(community, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 1

      assert user.id in community.meta.subscribed_user_ids
    end

    test "user unsubscribe a community will update the community's subscribted info",
         ~m(user community)a do
      {:ok, _} = CMS.subscribe_community(community, user)
      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 1
      assert user.id in community.meta.subscribed_user_ids

      {:ok, _} = CMS.unsubscribe_community(community, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 0
      assert user.id not in community.meta.subscribed_user_ids
    end

    test "user can get paged-subscribers of a community", ~m(community)a do
      {:ok, users} = db_insert_multi(:user, 25)

      Enum.each(users, &CMS.subscribe_community(community, %User{id: &1.id}))

      {:ok, results} =
        CMS.community_members(:subscribers, %Community{id: community.id}, %{page: 1, size: 10})

      assert results |> is_valid_pagination?(:raw)
    end
  end
end
