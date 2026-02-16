defmodule GroupherServer.Test.CMS.Communities.Moderator do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user2} = db_insert(:user)
    
    {:ok, ~m(user user2 community)a}
  end

  describe "[cms community moderator]" do
    test "can add moderator to a community", ~m(user user2 community)a do
      cur_user = user

      role = "moderator"
      {:ok, community} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      assert community.moderators_count == 2
      assert user.id in community.meta.moderators_ids
      assert user2.id in community.meta.moderators_ids
    end

    test "can unset moderator to a community", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user

      {:ok, community} = CMS.Communities.add_moderator(community, role, user2, cur_user)
      assert community.moderators_count == 2

      {:ok, community} = CMS.Communities.remove_moderator(community.slug, user2, cur_user)
      assert community.moderators_count == 1
      assert user2.id not in community.meta.moderators_ids
    end
  end
end
