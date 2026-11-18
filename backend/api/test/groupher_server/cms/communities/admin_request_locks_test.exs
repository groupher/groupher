defmodule GroupherServer.Test.CMS.Communities.AdminRequestLocksTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Communities.Admins.Requests.Locks
  alias GroupherServer.CMS.Model.CommunityAdminRequest

  test "locks canonical resources in order and requires every request subject" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    request =
      Repo.insert!(
        CommunityAdminRequest.changeset(%CommunityAdminRequest{}, %{
          community_id: community.id,
          subject_user_id: subject.id,
          created_by_id: owner.id,
          type: :invite,
          proposed_permissions: %{},
          expires_at: DateTime.add(DateTime.utc_now(:second), 604_800)
        })
      )

    assert {:ok, {:ok, locked}} =
             Repo.transaction(fn ->
               Locks.lock(community.id, [subject.id, owner.id], [request.id])
             end)

    assert locked.community.id == community.id
    assert Enum.map(locked.users, & &1.id) == Enum.sort([owner.id, subject.id])
    assert Enum.map(locked.requests, & &1.id) == [request.id]

    assert {:ok, {:error, :invalid_or_missing_lock_target}} =
             Repo.transaction(fn -> Locks.lock(community.id, [owner.id], [request.id]) end)

    assert {:ok, {:error, :invalid_or_missing_lock_target}} =
             Repo.transaction(fn ->
               Locks.lock(community.id, [owner.id], [Ecto.UUID.generate()])
             end)
  end
end
