defmodule GroupherServer.Test.CMS.Communities.AdminRequestCreateTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.CMS.Communities.Admins.Requests.Commands.Create
  alias GroupherServer.CMS.Model.{CommunityAdmin, CommunityAdminRequest}
  alias GroupherServer.CMS.Outbox.Event

  test "invite is a receipt-backed request, never a direct membership grant" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    lord = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    lord |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()
    command_id = Ecto.UUID.generate()
    permissions = %{"doc.queue.write" => true}

    assert {:ok, first} =
             Create.execute(community, subject, :invite, permissions, owner, command_id)

    assert first.status == :pending
    refute Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id)

    assert {:ok, replay} =
             Create.execute(community, subject, :invite, permissions, owner, command_id)

    assert replay.id == first.id
    assert 1 == Repo.aggregate(from(e in Event, where: e.resource_id == ^first.id), :count)

    assert {:ok, existing} =
             Create.execute(community, subject, :apply, %{}, subject, Ecto.UUID.generate())

    assert existing.id == first.id
    assert existing.proposed_permissions == permissions
  end

  test "expired request is terminal before a new pending request is inserted" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    lord = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    lord |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    assert {:ok, old} =
             Create.execute(community, subject, :apply, %{}, subject, Ecto.UUID.generate())

    old
    |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(:second), -1))
    |> Repo.update!()

    assert {:ok, new} =
             Create.execute(community, subject, :apply, %{}, subject, Ecto.UUID.generate())

    refute new.id == old.id
    assert Repo.get!(CommunityAdminRequest, old.id).status == :expired
    assert new.status == :pending

    expired =
      Repo.all(from(e in Event, where: e.resource_id == ^old.id))
      |> Enum.filter(&(&1.data["event_type"] == "expired"))

    assert Enum.sort(Enum.map(expired, & &1.data["recipient_id"])) ==
             Enum.sort([subject.id, owner.id])
  end

  test "system expiry notifies subject and current lord without disclosing to a former lord" do
    {:ok, former} = db_insert(:user)
    {:ok, current} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(former)
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: former.id)
    member = member |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    assert {:ok, old} =
             Create.execute(community, subject, :invite, %{}, former, Ecto.UUID.generate())

    old
    |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(:second), -1))
    |> Repo.update!()

    member |> Ecto.Changeset.change(is_lord: false) |> Repo.update!()

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        community_id: community.id,
        user_id: current.id,
        is_lord: true
      })
    )

    command_id = Ecto.UUID.generate()
    assert {:ok, new} = Create.execute(community, subject, :apply, %{}, subject, command_id)
    assert {:ok, replay} = Create.execute(community, subject, :apply, %{}, subject, command_id)
    assert replay.id == new.id

    expired =
      Repo.all(
        from(e in Event, where: e.resource_id == ^old.id and e.event == "community.admin_request")
      )
      |> Enum.filter(&(&1.data["event_type"] == "expired"))

    assert Enum.sort(Enum.map(expired, & &1.data["recipient_id"])) ==
             Enum.sort([subject.id, current.id])

    assert Enum.all?(expired, &(&1.data["actor"] == %{"type" => "system"}))
  end

  test "missing canonical users and hidden application do not create requests" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
    member |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()
    missing = %GroupherServer.Accounts.Model.User{id: 9_999_999_999}

    assert {:error, _} =
             Create.execute(community, missing, :invite, %{}, owner, Ecto.UUID.generate())

    assert {:error, _} =
             Create.execute(community, missing, :apply, %{}, missing, Ecto.UUID.generate())

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    lifecycle |> Ecto.Changeset.change(state: :suspended) |> Repo.update!()

    assert {:error, _} =
             Create.execute(community, subject, :apply, %{}, subject, Ecto.UUID.generate())

    refute Repo.exists?(from(r in CommunityAdminRequest, where: r.community_id == ^community.id))
  end

  @tag skip: System.get_env("TEST_ADMIN_ISOLATED") != "1"
  test "independent concurrent invites return one pending request and one intent" do
    Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
      {:ok, owner} = db_insert(:user)
      {:ok, subject} = db_insert(:user)
      {:ok, community} = mock_community(owner)
      member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: owner.id)
      member |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
              Create.execute(community, subject, :invite, %{}, owner, Ecto.UUID.generate())
            end)
          end)
        end

      assert [{:ok, first}, {:ok, second}] = Task.await_many(tasks, 20_000)
      assert first.id == second.id

      assert Repo.aggregate(
               from(r in CommunityAdminRequest,
                 where: r.community_id == ^community.id and r.status == :pending
               ),
               :count
             ) == 1

      assert Repo.aggregate(
               from(e in Event,
                 where: e.resource_id == ^first.id and e.event == "community.admin_request"
               ),
               :count
             ) == 1
    end)
  end
end
