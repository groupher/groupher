defmodule GroupherServer.Test.CMS.Communities.AdminRequestExpireTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Jobs}

  alias CMS.Communities.Admins.Requests.{
    Commands.Create,
    Commands.Expire
  }

  alias CMS.Model.CommunityAdmin
  alias CMS.Outbox.Event
  alias Jobs.ExpireCommunityAdminRequests

  test "bounded scan rechecks and expires only due pending requests once" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    member |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    assert {:ok, request} =
             Create.execute(community, subject, :apply, %{}, subject, Ecto.UUID.generate())

    now = DateTime.utc_now(:second)
    request |> Ecto.Changeset.change(expires_at: DateTime.add(now, -1)) |> Repo.update!()

    assert {:ok, :pass} = ExpireCommunityAdminRequests.perform(%Oban.Job{})
    assert {:ok, :unchanged} = Expire.execute(request.id, now)
    assert {:ok, :pass} = ExpireCommunityAdminRequests.perform(%Oban.Job{})
    intents = Repo.all(from(e in Event, where: e.resource_id == ^request.id))
    expired = Enum.filter(intents, &(&1.data["event_type"] == "expired"))

    assert Enum.sort(Enum.map(expired, & &1.data["recipient_id"])) ==
             Enum.sort([owner.id, subject.id])
  end
end
