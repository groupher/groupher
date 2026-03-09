defmodule GroupherServer.Test.CMS.Communities.Threads do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user community)a}
  end

  describe "[cms community thread]" do
    test "can create thread to a community" do
      title = "OTHER"
      slug = "other"
      {:ok, thread} = CMS.Communities.create_thread(~m(title slug)a)
      assert thread.title == title
    end

    test "create thread with exist title fails" do
      title = "POST"
      slug = "post"
      {:ok, _} = CMS.Communities.create_thread(~m(title slug)a)
      assert {:error, _error} = CMS.Communities.create_thread(~m(title slug)a)
    end

    test "can set a thread to community", ~m(community)a do
      title = "POST"
      slug = title

      {:ok, thread} = CMS.Communities.create_thread(~m(title slug)a)
      {:ok, ret_community} = CMS.Communities.set_thread(community, thread)

      assert ret_community.id == community.id
    end
  end
end
