defmodule GroupherServer.Test.CMS.DocTree.ReleaseEffectsTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.DocTree.Commands.ReleaseQueue
  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{
    CommandReceipt,
    CommunityAdmin,
    DocsRelease,
    DocsQueueTreeChange
  }

  alias CMS.Outbox.Event

  test "Docs directory release and Outbox intent roll back together under one operation" do
    {:ok, community} = mock_community()
    actor = Repo.get!(Accounts.Model.User, community.user_id)
    lord = Repo.get_by!(CommunityAdmin, user_id: actor.id, community_id: community.id)
    Repo.update!(Ecto.Changeset.change(lord, is_lord: true))
    operation_ref = Ecto.UUID.generate()

    target = [
      %{
        node_id: "release-tab",
        type: :tab,
        parent_node_id: nil,
        index: 0,
        title: "Docs",
        href: nil,
        doc_id: nil,
        marker: nil,
        badge: nil,
        hidden: false
      }
    ]

    assert {:ok, {_queue, _reconciled}} =
             Repo.transaction(fn ->
               {:ok, queue} = Queue.lock_or_create(community)

               {:ok, reconciled} =
                 Queue.reconcile_tree(
                   community,
                   queue,
                   queue.queue_revision,
                   [],
                   target,
                   actor,
                   operation_ref
                 )

               {queue, reconciled}
             end)

    {:ok, queued} = Queue.read(community)
    assert Repo.exists?(from(change in DocsQueueTreeChange, where: change.queue_id == ^queued.id))

    command_id = Ecto.UUID.generate()
    resource_id = Integer.to_string(community.id)

    existing_release_ids =
      Repo.all(
        from(release in DocsRelease,
          where: release.community_id == ^community.id,
          select: release.id
        )
      )

    existing_event_ids =
      Repo.all(
        from(event in Event,
          where: event.resource_type == "community" and event.resource_id == ^resource_id,
          select: event.id
        )
      )

    assert {:error, :rollback_release} =
             Repo.transaction(fn ->
               assert {:ok, result} =
                        ReleaseQueue.execute(community, queued.queue_revision, actor, command_id)

               release = Repo.get!(DocsRelease, result.release_id)
               assert release.sealed
               assert release.community_id == community.id

               receipt = Repo.get_by!(CommandReceipt, command_id: command_id)

               assert [event] =
                        Repo.all(
                          from(event in Event,
                            where:
                              event.operation_ref == ^receipt.operation_ref and
                                event.event == "doc_tree.changed" and
                                event.resource_type == "community" and
                                event.resource_id == ^resource_id
                          )
                        )

               assert event.operation_ref == receipt.operation_ref

               Repo.rollback(:rollback_release)
             end)

    assert Repo.all(
             from(release in DocsRelease,
               where: release.community_id == ^community.id,
               select: release.id
             )
           ) == existing_release_ids

    refute Repo.get_by(CommandReceipt, command_id: command_id)

    assert Repo.all(
             from(event in Event,
               where: event.resource_type == "community" and event.resource_id == ^resource_id,
               select: event.id
             )
           ) == existing_event_ids
  end
end
