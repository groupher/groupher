defmodule GroupherServer.Test.CMS.Communities.AdminRequestActivityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.Activity

  test "Admin request Activity retains its identities and permissions" do
    {:ok, actor} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(actor)
    request_id = Ecto.UUID.generate()
    operation_ref = Ecto.UUID.generate()

    assert {:ok, log} =
             Activity.log(community, :admin_request_created,
               actor: actor,
               operation_ref: operation_ref,
               operation_index: 0,
               metadata: %{
                 subject_user_id: subject.id,
                 request_id: request_id,
                 request_type: "invite",
                 proposed_permissions: %{"doc.queue.write" => true},
                 before_permissions: %{},
                 after_permissions: %{}
               }
             )

    assert log.action == :admin_request_created
    assert log.operation_ref == operation_ref
    log = Repo.get!(GroupherServer.Activity.Model.CommunityLog, log.id)
    assert log.metadata["subject_user_id"] == subject.id
    assert log.metadata["request_id"] == request_id
    assert log.metadata["proposed_permissions"] == %{"doc.queue.write" => true}
  end

  test "Admin membership Activity accepts the metadata produced by both decision paths" do
    {:ok, actor} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(actor)
    request_id = Ecto.UUID.generate()

    assert {:ok, joined} =
             Activity.log(community, :admin_joined,
               actor: actor,
               metadata: %{
                 subject_user_id: subject.id,
                 request_id: request_id,
                 member_id: 101,
                 before_permissions: %{},
                 after_permissions: %{"doc.queue.write" => true}
               }
             )

    assert joined.action == :admin_joined

    assert {:ok, changed_from_request} =
             Activity.log(community, :admin_permissions_changed,
               actor: actor,
               metadata: %{
                 subject_user_id: subject.id,
                 request_id: request_id,
                 member_id: 101,
                 before_permissions: %{"doc.queue.write" => true},
                 after_permissions: %{"doc.queue.write" => true, "doc.queue.approve" => true}
               }
             )

    assert changed_from_request.action == :admin_permissions_changed

    assert {:ok, changed_directly} =
             Activity.log(community, :admin_permissions_changed,
               actor: actor,
               metadata: %{
                 subject_user_id: subject.id,
                 member_id: 101,
                 before_permissions: %{"doc.queue.write" => true},
                 after_permissions: %{"doc.queue.write" => true, "doc.queue.approve" => true}
               }
             )

    assert changed_directly.action == :admin_permissions_changed

    assert {:ok, removed} =
             Activity.log(community, :admin_removed,
               actor: actor,
               metadata: %{
                 subject_user_id: subject.id,
                 member_id: 101,
                 before_permissions: %{"doc.queue.write" => true},
                 after_permissions: %{}
               }
             )

    assert removed.action == :admin_removed
  end

  test "private Admin events are filtered from list, stats, detail and export" do
    {:ok, owner} = db_insert(:user)
    {:ok, outsider} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityAdmin,
        community_id: community.id,
        user_id: owner.id
      )

    member |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()

    Repo.insert!(%GroupherServer.CMS.Model.CommunityAdmin{
      community_id: community.id,
      user_id: outsider.id,
      permissions: %{"audit.read" => true}
    })

    assert {:ok, public} = Activity.log(community, :activated, actor: owner)

    assert {:ok, private} =
             Activity.log(community, :admin_request_created,
               actor: owner,
               parent_event_ref: public.event_ref,
               metadata: %{subject_user_id: outsider.id, request_id: Ecto.UUID.generate()}
             )

    now = DateTime.utc_now(:second)

    selection = %{
      filter: %{
        resource_types: ["community"],
        actions: ["activated", "admin_request_created"],
        occurred_after: DateTime.add(now, -86_400),
        occurred_before: DateTime.add(now, 86_400)
      }
    }

    assert {:ok, hidden} = Activity.list_community_logs(community, outsider, selection)
    refute Enum.any?(hidden.entries, &(&1.event_ref == private.event_ref))
    assert hidden.page_info.total_count == 1

    assert {:ok, %{total_count: 1}} =
             Activity.get_community_log_stats(community, outsider, selection)

    assert {:ok, nil} = Activity.CommunityLog.get_event(community, outsider, private.event_ref)

    assert {:ok, %{child_events: []}} =
             Activity.get_community_log_event(community, outsider, public.event_ref)

    assert {:ok, exported} = Activity.export_community_logs(community, outsider, selection, :json)
    refute exported.content =~ private.event_ref

    assert {:ok, visible} = Activity.list_community_logs(community, owner, selection)
    assert Enum.any?(visible.entries, &(&1.event_ref == private.event_ref))
    assert visible.page_info.total_count == 2

    assert {:ok, %{total_count: 2}} =
             Activity.get_community_log_stats(community, owner, selection)

    assert {:ok, %{event_ref: _}} =
             Activity.CommunityLog.get_event(community, owner, private.event_ref)

    assert {:ok, %{child_events: [child]}} =
             Activity.get_community_log_event(community, owner, public.event_ref)

    assert child.event_ref == private.event_ref

    {:ok, other_community} = mock_community(outsider)

    other_admin =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityAdmin,
        community_id: other_community.id,
        user_id: outsider.id
      )

    other_admin |> Ecto.Changeset.change(is_lord: true) |> Repo.update!()
    assert {:ok, cross_scope} = Activity.list_community_logs(community, outsider, selection)
    refute Enum.any?(cross_scope.entries, &(&1.event_ref == private.event_ref))

    root =
      Repo.insert!(%GroupherServer.CMS.Model.GlobalPassport{user_id: outsider.id, is_root: true})

    assert {:ok, root_view} = Activity.list_community_logs(community, outsider, selection)
    assert Enum.any?(root_view.entries, &(&1.event_ref == private.event_ref))

    root |> Ecto.Changeset.change(permissions: %{"invalid.action" => true}) |> Repo.update!()

    assert {:error, %{reason: :permission_denied}} =
             Activity.list_community_logs(community, outsider, selection)
  end
end
