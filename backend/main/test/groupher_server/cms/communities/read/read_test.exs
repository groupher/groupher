defmodule GroupherServer.Test.CMS.Communities.Read do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, ~m(user community user2 user3)a}
  end

  describe "[cms community read]" do
    test "read community should inc views", ~m(community)a do
      {:ok, community} = CMS.Communities.read(community.slug)
      assert community.views == 1
      {:ok, community} = CMS.Communities.read(community.slug)
      assert community.views == 2
      {:ok, community} = CMS.Communities.read(community.slug)
      assert community.views == 3
    end

    test "read community should not inc views if opt provide", ~m(community)a do
      {:ok, community} = CMS.Communities.read(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.Communities.read(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.Communities.read(community.slug, inc_views: false)
      assert community.views == 0
    end

    test "read subscribed community should have a flag", ~m(community user user2)a do
      {:ok, _} = CMS.Communities.subscribe(community, user)

      {:ok, community} = CMS.Communities.read(community.slug, user)

      assert community.viewer_has_subscribed
      assert user.id in community.meta.subscribed_user_ids

      {:ok, community} = CMS.Communities.read(community.slug, user2)
      assert not community.viewer_has_subscribed
      assert user2.id not in community.meta.subscribed_user_ids
    end

    test "read moderatorable community should have a flag", ~m(community user user2 user3)a do
      cur_user = user
      {:ok, community} = CMS.Communities.add_moderator(community, user2, cur_user)

      {:ok, community} = CMS.Communities.read(community.slug, user2)
      assert community.viewer_is_moderator

      {:ok, community} = CMS.Communities.read(community.slug, user3)
      assert not community.viewer_is_moderator

      {:ok, community} = CMS.Communities.remove_moderator(community.slug, user2, cur_user)
      {:ok, community} = CMS.Communities.read(community.slug, user2)

      assert not community.viewer_is_moderator
    end
  end
end
