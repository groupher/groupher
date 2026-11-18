defmodule GroupherServer.Test.CMS.Communities.AdminRequestGateTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{CommunityAdmin, CommunityLifecycle, GlobalPassport}

  test "only the site's current lord or Global root can invite" do
    {:ok, owner} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    admin = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    admin |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    assert {:ok, _} = CMS.Gate.access_check(owner, :admin_invite, community)
    assert {:error, _} = CMS.Gate.access_check(other, :admin_invite, community)
    Repo.insert!(%GlobalPassport{user_id: other.id, is_root: true})
    assert {:ok, _} = CMS.Gate.access_check(other, :admin_invite, community)
  end

  test "apply requires public readability and manageable lifecycle" do
    {:ok, owner} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    assert {:ok, _} = CMS.Gate.access_check(other, :admin_apply, community)
    assert {:error, _} = CMS.Gate.access_check(nil, :admin_apply, community)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> Ecto.Changeset.change(state: :suspended)
    |> Repo.update!()

    assert {:error, _} = CMS.Gate.access_check(other, :admin_apply, community)
  end
end
