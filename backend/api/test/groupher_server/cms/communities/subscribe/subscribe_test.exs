defmodule GroupherServer.Test.CMS.Communities.Subscribe do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user community)a}
  end

  describe "[cms community subscribe]" do
    test "user can subscribe a community", ~m(user community)a do
      {:ok, record} = CMS.Communities.subscribe(community, user)
      assert community.id == record.id
    end

    test "user subscribe a community will update the community's subscribted info",
         ~m(user community)a do
      assert community.subscribers_count == 0
      {:ok, _record} = CMS.Communities.subscribe(community, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 1

      assert user.id in community.meta.subscribed_user_ids
    end

    test "user unsubscribe a community will update the community's subscribted info",
         ~m(user community)a do
      {:ok, _} = CMS.Communities.subscribe(community, user)
      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 1
      assert user.id in community.meta.subscribed_user_ids

      {:ok, _} = CMS.Communities.unsubscribe(community, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.subscribers_count == 0
      assert user.id not in community.meta.subscribed_user_ids
    end

    test "user can get paged-subscribers of a community", ~m(community)a do
      {:ok, users} = db_insert_multi(:user, 25)

      Enum.each(users, &CMS.Communities.subscribe(community, %User{id: &1.id}))

      {:ok, results} =
        CMS.Communities.members(:subscribers, %Community{id: community.id}, %{page: 1, size: 10})

      assert results |> is_valid_pagination?(:raw)
    end
  end
end
