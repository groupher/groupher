defmodule GroupherServer.Test.CMS.Communities.Apply do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    
    {:ok, ~m(user user2)a}
  end

  describe "[cms community apply]" do
    test "apply community can set root user by default", ~m(user)a do
      attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.apply(attrs, user)

      {:ok, community} = ORM.find(Community, community.id, preload: [moderators: :user])
      moderator_user = community.moderators |> Enum.at(0)

      assert moderator_user.user_id == user.id
    end

    test "apply can be deny", ~m(user)a do
      attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.apply(attrs, user)
      {:ok, community} = CMS.Communities.deny_apply(community.id)

      {:error, _} = ORM.find(Community, community.id)
    end

    test "user can query has pending apply or not", ~m(user user2)a do
      attrs = mock_attrs(:community)
      {:ok, _community} = CMS.Communities.apply(attrs, user)

      {:ok, state} = CMS.Communities.has_pending_apply?(user)
      assert state.exist

      {:ok, state} = CMS.Communities.has_pending_apply?(user2)
      assert not state.exist
    end
  end
end
