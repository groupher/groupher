defmodule GroupherServer.Test.CMS.Events.Audition.PostTest do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, post} = db_insert(:post)

    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user community post post_attrs)a}
  end

  describe "[audit post basic]" do
  end
end
