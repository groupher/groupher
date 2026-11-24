defmodule GroupherServer.Test.CMS.Communities.AdminManagementCommandsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Communities.Admins.Commands.{Remove, UpdatePermissions}
  alias CMS.Model.{CommunityAdmin, CommunityAdminRequest}

  test "permission replacement checks revision and writes new Passport facts" do
    {:ok, lord} = db_insert(:user)
    {:ok, admin_user} = db_insert(:user)
    {:ok, community} = mock_community(lord)

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    Repo.update!(Ecto.Changeset.change(lifecycle, state: :active))
    lord_member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: lord.id)
    Repo.update!(Ecto.Changeset.change(lord_member, is_lord: true))

    admin =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: admin_user.id,
          permissions: %{"doc.queue.write" => true}
        })
      )

    assert {:ok, updated} =
             UpdatePermissions.execute(
               community,
               admin.id,
               admin.revision,
               %{"doc.queue.write" => true},
               lord,
               Ecto.UUID.generate()
             )

    assert updated.revision == admin.revision + 1
    assert updated.permissions["doc.queue.write"]

    assert {:error, _} =
             UpdatePermissions.execute(
               community,
               admin.id,
               admin.revision,
               %{},
               lord,
               Ecto.UUID.generate()
             )
  end

  test "removing an admin cancels their pending request in the same transaction" do
    {:ok, lord} = db_insert(:user)
    {:ok, admin_user} = db_insert(:user)
    {:ok, community} = mock_community(lord)

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    Repo.update!(Ecto.Changeset.change(lifecycle, state: :active))
    lord_member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: lord.id)
    Repo.update!(Ecto.Changeset.change(lord_member, is_lord: true))

    admin =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: admin_user.id,
          permissions: %{"doc.queue.write" => true}
        })
      )

    request =
      Repo.insert!(
        CommunityAdminRequest.changeset(%CommunityAdminRequest{}, %{
          community_id: community.id,
          subject_user_id: admin_user.id,
          created_by_id: admin_user.id,
          type: :apply,
          status: :pending,
          proposed_permissions: %{},
          revision: 1,
          expires_at: DateTime.add(DateTime.utc_now(:second), 86_400)
        })
      )

    assert {:ok, true} =
             Remove.execute(community, admin.id, admin.revision, lord, Ecto.UUID.generate())

    assert Repo.get(CommunityAdmin, admin.id) == nil
    assert Repo.get!(CommunityAdminRequest, request.id).status == :cancelled
  end

  test "ordinary admins can leave while lord membership stays protected" do
    {:ok, lord} = db_insert(:user)
    {:ok, admin_user} = db_insert(:user)
    {:ok, community} = mock_community(lord)
    lord_member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: lord.id)
    Repo.update!(Ecto.Changeset.change(lord_member, is_lord: true))

    admin =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: admin_user.id,
          permissions: %{"doc.queue.write" => true}
        })
      )

    assert {:ok, true} =
             Remove.execute(community, admin.id, admin.revision, admin_user, Ecto.UUID.generate())

    refute Repo.get(CommunityAdmin, admin.id)
    assert Repo.get(CommunityAdmin, lord_member.id)

    assert {:error, :lord_membership_immutable} =
             Remove.execute(
               community,
               lord_member.id,
               lord_member.revision,
               lord,
               Ecto.UUID.generate()
             )
  end
end
