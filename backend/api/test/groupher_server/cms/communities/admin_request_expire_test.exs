defmodule GroupherServer.Test.CMS.Communities.AdminRequestExpireTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Jobs}

  alias CMS.Communities.Admins.Requests.{
    Commands.Create,
    Commands.Expire,
    ExpireDue
  }

  alias CMS.Model.{CommunityAdmin, CommunityAdminRequest}
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

  test "scan continues after an expiry error and returns an aggregated failure" do
    {:ok, owner} = db_insert(:user)
    {:ok, failed_subject} = db_insert(:user)
    {:ok, later_subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:ok, failed_request} =
             Create.execute(
               community,
               failed_subject,
               :apply,
               %{},
               failed_subject,
               Ecto.UUID.generate()
             )

    assert {:ok, later_request} =
             Create.execute(
               community,
               later_subject,
               :apply,
               %{},
               later_subject,
               Ecto.UUID.generate()
             )

    now = DateTime.utc_now(:second)

    failed_request
    |> Ecto.Changeset.change(expires_at: DateTime.add(now, -2, :second))
    |> Repo.update!()

    later_request
    |> Ecto.Changeset.change(expires_at: DateTime.add(now, -1, :second))
    |> Repo.update!()

    expire = fn id, at ->
      if id == failed_request.id do
        {:error, :forced_failure}
      else
        Expire.execute(id, at)
      end
    end

    assert {:error,
            {:request_expiration_failures,
             %{count: 1, sample: [{failed_id, :forced_failure}]}}} =
             ExpireDue.run_with_executor(now, expire)

    assert failed_id == failed_request.id
    assert Repo.get!(CommunityAdminRequest, failed_request.id).status == :pending
    assert Repo.get!(CommunityAdminRequest, later_request.id).status == :expired
  end
end
