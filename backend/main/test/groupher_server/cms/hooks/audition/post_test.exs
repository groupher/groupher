defmodule GroupherServer.Test.CMS.Hooks.Audition.PostTest do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, post} = db_insert(:post)

    {:ok, community} = db_insert(:community)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user community post post_attrs)a}
  end

  describe "[audit post basic]" do
  end
end
