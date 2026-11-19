defmodule GroupherServer.Test.CMS.Communities.AdminRequestDecideTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Communities.Admins.Requests.Commands.{Create, Decide}
  alias CMS.Model.{CommunityAdmin, CommunityAdminRequest}
  alias CMS.Outbox.Event

  test "invite decision grants once and receipt replay cannot recreate a removed member" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    lord = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    lord |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()
    proposed = %{"doc.queue.write" => true}

    assert {:ok, request} =
             Create.execute(community, subject, :invite, proposed, owner, Ecto.UUID.generate())

    assert {:error, _} =
             Decide.execute(
               community,
               request.id,
               request.revision,
               :accept,
               proposed,
               owner,
               Ecto.UUID.generate()
             )

    command = Ecto.UUID.generate()

    assert {:ok, decided} =
             Decide.execute(
               community,
               request.id,
               request.revision,
               :accept,
               proposed,
               subject,
               command
             )

    assert decided.status == :decided and decided.decision == :accept
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: subject.id)
    assert member.permissions == proposed
    event_count = Repo.aggregate(from(e in Event, where: e.resource_id == ^request.id), :count)
    Repo.delete!(member)

    assert {:ok, replay} =
             Decide.execute(
               community,
               request.id,
               request.revision,
               :accept,
               proposed,
               subject,
               command
             )

    assert replay.id == request.id
    refute Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id)

    assert Repo.aggregate(from(e in Event, where: e.resource_id == ^request.id), :count) ==
             event_count

    assert {:error, :request_already_decided} =
             Decide.execute(
               community,
               request.id,
               decided.revision,
               :accept,
               proposed,
               subject,
               Ecto.UUID.generate()
             )
  end

  test "application approval is a proposal subset and augments existing permissions" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    lord = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    lord |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: subject.id,
          permissions: %{"doc.queue.preview" => true}
        })
      )

    proposed = %{"doc.queue.write" => true, "doc.queue.approve" => true}

    assert {:ok, request} =
             Create.execute(community, subject, :apply, proposed, subject, Ecto.UUID.generate())

    assert {:error, _} =
             Decide.execute(
               community,
               request.id,
               request.revision,
               :accept,
               %{"doc.queue.publish" => true},
               owner,
               Ecto.UUID.generate()
             )

    assert Repo.get!(CommunityAdminRequest, request.id).status == :pending

    assert {:ok, decided} =
             Decide.execute(
               community,
               request.id,
               request.revision,
               :accept,
               %{"doc.queue.write" => true},
               owner,
               Ecto.UUID.generate()
             )

    assert decided.approved_permissions == %{"doc.queue.write" => true}

    assert Repo.get!(CommunityAdmin, member.id).permissions == %{
             "doc.queue.preview" => true,
             "doc.queue.write" => true
           }
  end
end
