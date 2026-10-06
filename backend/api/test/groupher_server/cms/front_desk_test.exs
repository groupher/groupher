defmodule GroupherServer.Test.CMS.FrontDeskTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  setup do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, ~m(owner community)a}
  end

  test "community reads use the public policy by default", ~m(community)a do
    assert {:ok, loaded} = CMS.FrontDesk.community(community.slug)
    assert loaded.id == community.id
  end

  test "community reads accept an explicit management actor and mode", ~m(owner community)a do
    assert {:ok, loaded} = CMS.FrontDesk.community(community.slug, owner, mode: :management)
    assert loaded.id == community.id
  end

  test "community reads reject unsupported modes", ~m(owner community)a do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :unknown_policy_mode}} =
             CMS.FrontDesk.community(community.slug, owner, mode: :test)
  end
end
