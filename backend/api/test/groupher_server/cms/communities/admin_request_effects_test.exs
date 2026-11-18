defmodule GroupherServer.Test.CMS.Communities.AdminRequestEffectsTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.CMS.Communities.Admins.Effects
  alias GroupherServer.CMS.Model.CommunityAdminRequest
  alias GroupherServer.CMS.Outbox.Event

  test "recipient intents deduplicate and roll back with the domain transaction" do
    {:ok, actor} = db_insert(:user)
    {:ok, recipient} = db_insert(:user)
    {:ok, community} = mock_community(actor)

    request = %CommunityAdminRequest{
      id: Ecto.UUID.generate(),
      community_id: community.id,
      revision: 1,
      type: :invite
    }

    operation = Ecto.UUID.generate()

    assert {:error, :failed_later} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          request,
                          :created,
                          actor,
                          [recipient.id],
                          operation
                        )

               Repo.rollback(:failed_later)
             end)

    refute Repo.exists?(from(e in Event, where: e.command_id == ^operation))

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          request,
                          :created,
                          actor,
                          [recipient.id, recipient.id],
                          operation
                        )

               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          request,
                          :created,
                          actor,
                          [recipient.id],
                          operation
                        )

               :pass
             end)

    assert Repo.aggregate(from(e in Event, where: e.command_id == ^operation), :count) == 1

    event = Repo.one!(from(e in Event, where: e.command_id == ^operation))
    assert event.identity_type == :operation
    assert event.data["request_id"] == request.id
    assert event.data["recipient_id"] == recipient.id

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAdminRequest.perform(%Oban.Job{
               args: %{"event_id" => event.id}
             })

    assert Repo.get!(Event, event.id).status == :done

    notice =
      Repo.one!(
        from(n in GroupherServer.Messaging.Model.Notice, where: n.request_id == ^request.id)
      )

    assert notice.user_id == recipient.id
    assert notice.request_type == :community_admin
    assert notice.event_type == :created
    assert notice.type == :invite
    assert length(notice.from_users) == 1

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAdminRequest.perform(%Oban.Job{
               args: %{"event_id" => event.id}
             })

    assert Repo.aggregate(
             from(n in GroupherServer.Messaging.Model.Notice,
               where: n.request_id == ^request.id
             ),
             :count
           ) == 1
  end

  test "application and result requests deliver their declared action and actor" do
    {:ok, actor} = db_insert(:user)
    {:ok, recipient} = db_insert(:user)
    {:ok, community} = mock_community(actor)

    request = %CommunityAdminRequest{
      id: Ecto.UUID.generate(),
      community_id: community.id,
      revision: 1,
      type: :apply
    }

    operation = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          request,
                          :created,
                          actor,
                          [recipient.id],
                          operation
                        )

               :pass
             end)

    event = Repo.one!(from(e in Event, where: e.command_id == ^operation))

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAdminRequest.perform(%Oban.Job{
               args: %{"event_id" => event.id}
             })

    notice =
      Repo.one!(
        from(n in GroupherServer.Messaging.Model.Notice, where: n.request_id == ^request.id)
      )

    assert notice.type == :apply
    assert hd(notice.from_users).user_id == actor.id

    result_request = %{request | revision: 2}
    result_operation = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          result_request,
                          :decided,
                          actor,
                          [recipient.id],
                          result_operation
                        )

               :pass
             end)

    result_event = Repo.one!(from(e in Event, where: e.command_id == ^result_operation))

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAdminRequest.perform(%Oban.Job{
               args: %{"event_id" => result_event.id}
             })

    result_notice =
      Repo.one!(
        from(n in GroupherServer.Messaging.Model.Notice,
          where: n.request_id == ^request.id and n.event_type == :decided
        )
      )

    assert result_notice.type == :result
    assert hd(result_notice.from_users).user_id == actor.id
  end

  test "system expiry result permits an empty actor snapshot" do
    {:ok, actor} = db_insert(:user)
    {:ok, recipient} = db_insert(:user)
    {:ok, community} = mock_community(actor)

    request = %CommunityAdminRequest{
      id: Ecto.UUID.generate(),
      community_id: community.id,
      revision: 3,
      type: :invite
    }

    operation = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          community,
                          request,
                          :expired,
                          :system,
                          [recipient.id],
                          operation
                        )

               :pass
             end)

    event = Repo.one!(from(e in Event, where: e.command_id == ^operation))

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAdminRequest.perform(%Oban.Job{
               args: %{"event_id" => event.id}
             })

    notice =
      Repo.one!(
        from(n in GroupherServer.Messaging.Model.Notice, where: n.request_id == ^request.id)
      )

    assert notice.type == :result
    assert notice.from_users == []
    assert notice.from_users_count == 0
  end
end
