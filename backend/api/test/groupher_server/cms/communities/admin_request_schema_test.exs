defmodule GroupherServer.Test.CMS.Communities.AdminRequestSchemaTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.CommunityAdminRequest

  test "one pending request per subject, immutable proposal, and valid terminal states" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    now = DateTime.utc_now(:second)

    attrs = %{
      community_id: community.id,
      subject_user_id: subject.id,
      created_by_id: owner.id,
      type: :invite,
      proposed_permissions: %{"doc.queue.write" => true},
      expires_at: DateTime.add(now, 7 * 24 * 60 * 60)
    }

    assert {:ok, request} =
             Repo.insert(CommunityAdminRequest.changeset(%CommunityAdminRequest{}, attrs))

    assert {:error, duplicate} =
             Repo.insert(
               CommunityAdminRequest.changeset(%CommunityAdminRequest{}, %{attrs | type: :apply}),
               mode: :savepoint
             )

    assert duplicate.errors[:community_id]

    assert {:error, changed} =
             request
             |> CommunityAdminRequest.changeset(%{
               proposed_permissions: %{"doc.queue.preview" => true}
             })
             |> Repo.update(mode: :savepoint)

    assert changed.errors[:proposed_permissions]

    assert {:error, invalid} =
             request
             |> CommunityAdminRequest.changeset(%{
               status: :decided,
               decision: nil,
               decided_by_id: subject.id,
               decided_at: now
             })
             |> Repo.update(mode: :savepoint)

    assert invalid.errors[:status]

    assert {:ok, _} =
             request
             |> CommunityAdminRequest.changeset(%{
               status: :decided,
               decision: :reject,
               decided_by_id: subject.id,
               decided_at: now
             })
             |> Repo.update()

    assert {:ok, _} =
             Repo.insert(
               CommunityAdminRequest.changeset(%CommunityAdminRequest{}, %{attrs | type: :apply})
             )
  end

  test "proposal rejects privileged, wrong-scope, and dependency-incomplete grants" do
    for permissions <- [
          %{"admin.invite" => true},
          %{"community.create" => true},
          %{"community.article.hide" => true},
          %{"unknown.action" => true}
        ] do
      changeset =
        CommunityAdminRequest.changeset(%CommunityAdminRequest{}, %{
          proposed_permissions: permissions
        })

      assert changeset.errors[:proposed_permissions]
    end
  end
end
