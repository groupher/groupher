defmodule GroupherServer.Test.CMS.Communities.LifecycleTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  require CMS.Const

  alias CMS.Communities.Lifecycle
  alias CMS.Gate.Context.Scope.Community, as: CommunityScope
  alias CMS.Model.{AuditLog, Community, CommunityLifecycle, CommunityLifecycleBlocker}

  test "projects blocker combinations into the strictest public state" do
    assert :active = Lifecycle.resolve_state([])

    assert :suspended =
             Lifecycle.resolve_state([
               %{blocker_type: :moderation_suspend}
             ])

    assert :archived =
             Lifecycle.resolve_state([
               %{blocker_type: :moderation_suspend},
               %{blocker_type: :owner_archive}
             ])
  end

  test "global community creation provisions an active Lifecycle row" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert %CommunityLifecycle{state: :active, version: 1} =
             Repo.get_by!(CommunityLifecycle, community_id: community.id)
  end

  test "read modes expose one shared Community state matrix" do
    matrix = %{
      public: [:active, :read_only],
      owner_management: [
        :setting_up,
        :setup_failed,
        :active,
        :read_only,
        :suspended,
        :archived,
        :pending_destroy
      ],
      moderator_management: [
        :setting_up,
        :setup_failed,
        :active,
        :read_only,
        :suspended,
        :archived,
        :pending_destroy
      ],
      operations: [
        :setting_up,
        :setup_failed,
        :active,
        :read_only,
        :suspended,
        :archived,
        :pending_destroy,
        :destroy
      ]
    }

    for {mode, readable_states} <- matrix,
        state <- CMS.Const.lifecycle_state_values() do
      resource = %CommunityLifecycle{state: state}
      expected = state in readable_states

      assert {:ok, ^expected} = Lifecycle.can_read_mode(resource, mode, %{})
    end
  end

  test "capabilities follow the Lifecycle state matrix" do
    assert {:ok, true} = Lifecycle.can_read(%CommunityLifecycle{state: :active})
    assert {:ok, true} = Lifecycle.can_read(%CommunityLifecycle{state: :read_only})
    assert {:ok, false} = Lifecycle.can_write(%CommunityLifecycle{state: :read_only})
    assert {:ok, true} = Lifecycle.can_manage(%CommunityLifecycle{state: :archived})
    assert {:ok, false} = Lifecycle.can_destroy(%CommunityLifecycle{state: :suspended})
    assert {:ok, false} = Lifecycle.can_read(%CommunityLifecycle{state: :destroy})
  end

  test "state capabilities do not query blockers and reclaim consumes loaded blockers" do
    handler_id = "lifecycle-capability-query-#{System.unique_integer([:positive])}"
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])
    parent = self()

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, _metadata, _config -> send(parent, :capability_query) end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert {:ok, true} = Lifecycle.can_read(%CommunityLifecycle{state: :active})
    assert {:ok, true} = Lifecycle.can_manage(%CommunityLifecycle{state: :archived})

    lifecycle = %CommunityLifecycle{
      state: :active,
      blockers: [
        %CommunityLifecycleBlocker{blocker_type: :ops_legal_hold, ended_at: nil}
      ]
    }

    assert {:ok, false} = Lifecycle.can_destroy(lifecycle)
    refute_receive :capability_query
  end

  test "reclaim requires blockers when the materialized state is eligible" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :lifecycle_not_loaded}} =
             Lifecycle.can_destroy(%CommunityLifecycle{state: :active})

    assert {:ok, true} =
             Lifecycle.can_destroy(%CommunityLifecycle{state: :active}, %{active_blockers: []})
  end

  test "applying and releasing a blocker is idempotent and recomputes state" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)
    operation_ref = Ecto.UUID.generate()

    assert {:ok, blocker} =
             Lifecycle.apply_blocker(
               community.slug,
               %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
               operation_ref: operation_ref
             )

    assert blocker.lifecycle_id == lifecycle.id
    assert Repo.get!(CommunityLifecycle, lifecycle.id).state == :suspended

    assert %AuditLog{operation_ref: ^operation_ref} =
             Repo.get_by!(AuditLog,
               community_id: community.id,
               action: "community.blocker_created"
             )

    assert {:ok, same_blocker} =
             Lifecycle.apply_blocker(
               community.slug,
               %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
               operation_ref: Ecto.UUID.generate()
             )

    assert same_blocker.id == blocker.id
    assert Repo.aggregate(CommunityLifecycleBlocker, :count) == 1

    assert {:error, %Ecto.Changeset{}} =
             Lifecycle.apply_blocker(
               community.slug,
               %{blocker_type: :moderation_archive, cause_code: "same_operation"},
               operation_ref: operation_ref
             )

    assert {:ok, _released} =
             Lifecycle.release_blocker(
               community.slug,
               :moderation_suspend,
               nil,
               operation_ref: Ecto.UUID.generate()
             )

    assert Repo.get!(CommunityLifecycle, lifecycle.id).state == :active
  end

  test "rejects a non-UUID operation ref without creating Lifecycle facts" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_operation_ref}} =
             Lifecycle.request_destroy(community.slug, operation_ref: "op_owner_archive")

    assert Repo.aggregate(CommunityLifecycleBlocker, :count) == 0

    refute Repo.exists?(
             from(audit in AuditLog,
               where: audit.community_id == ^community.id
             )
           )
  end

  test "generates one operation ref for an omitted blocker operation" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:ok, blocker} = Lifecycle.request_destroy(community.slug)

    audit =
      Repo.get_by!(AuditLog,
        community_id: community.id,
        action: "community.blocker_created"
      )

    assert blocker.created_by_operation_ref == audit.operation_ref
  end

  test "duplicate active blockers with a cause ref return a changeset error" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)

    attrs = %{
      community_id: community.id,
      lifecycle_id: lifecycle.id,
      blocker_type: :moderation_suspend,
      cause_code: "moderation_case",
      cause_ref: "case-1",
      applied_at: DateTime.utc_now(:second),
      created_by_operation_ref: Ecto.UUID.generate()
    }

    assert {:ok, _blocker} =
             %CommunityLifecycleBlocker{}
             |> CommunityLifecycleBlocker.changeset(attrs)
             |> Repo.insert()

    assert {:error, changeset} =
             %CommunityLifecycleBlocker{}
             |> CommunityLifecycleBlocker.changeset(%{
               attrs
               | created_by_operation_ref: Ecto.UUID.generate()
             })
             |> Repo.insert()

    assert {:cause_ref, {_message, _opts}} = List.keyfind(changeset.errors, :cause_ref, 0)
  end

  test "read_only remains public while restricted lifecycle states stay hidden" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    for state <- [:read_only, :suspended, :archived, :pending_destroy, :destroy] do
      _lifecycle =
        Repo.get_by!(CommunityLifecycle, community_id: community.id)
        |> CommunityLifecycle.changeset(%{state: state})
        |> Repo.update!()

      visible? =
        CMS.Gate.scope(Community, nil, :read, CommunityScope.public())
        |> where([candidate], candidate.id == ^community.id)
        |> Repo.exists?()

      assert visible? == (state == :read_only)
    end
  end

  test "archive and restore own blocker while honoring the recovery window" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)

    future = DateTime.add(DateTime.utc_now(:second), 3600, :second)

    assert {:ok, blocker} =
             Lifecycle.request_destroy(community.slug,
               recover_until: future,
               operation_ref: Ecto.UUID.generate()
             )

    assert blocker.blocker_type == :owner_archive
    assert Repo.get!(CommunityLifecycle, lifecycle.id).state == :archived

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :lifecycle_state_conflict}} =
             Lifecycle.restore(community.slug,
               expected_version: 1,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _released} =
             Lifecycle.restore(community.slug, operation_ref: Ecto.UUID.generate())

    assert {:ok, blocker} =
             Lifecycle.request_destroy(community.slug,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :archive_recovery_window_expired}} =
             Lifecycle.restore(community.slug, operation_ref: Ecto.UUID.generate())

    assert blocker.blocker_type == :owner_archive

    assert Repo.get!(CommunityLifecycle, lifecycle.id).state == :archived
  end

  test "reclaim commands guard blockers, cancel by projection and destroy atomically" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)

    assert {:ok, _archive} =
             Lifecycle.request_destroy(community.slug,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _scheduled} =
             Lifecycle.schedule_destroy(community.slug, operation_ref: Ecto.UUID.generate())

    assert {:ok, cancelled} =
             Lifecycle.cancel_destroy(community.slug, operation_ref: Ecto.UUID.generate())

    assert cancelled.state == :archived

    assert {:ok, _scheduled} =
             Lifecycle.schedule_destroy(community.slug, operation_ref: Ecto.UUID.generate())

    assert {:ok, destroyed} =
             Lifecycle.destroy(community.slug, operation_ref: Ecto.UUID.generate())

    assert destroyed.state == :destroy
    assert {:ok, reconciled} = Lifecycle.reconcile(community.id)
    assert reconciled.state == :destroy
    assert Repo.get!(CMS.Model.Community, community.id).slug == community.slug

    assert Repo.aggregate(
             from(blocker in CommunityLifecycleBlocker,
               where: blocker.lifecycle_id == ^lifecycle.id
             ),
             :count
           ) == 1

    refute Repo.exists?(
             from(blocker in CommunityLifecycleBlocker,
               where: blocker.lifecycle_id == ^lifecycle.id and is_nil(blocker.ended_at)
             )
           )

    assert Repo.exists?(
             from(audit in AuditLog,
               where:
                 audit.community_id == ^community.id and
                   audit.action == "community.blocker_terminated"
             )
           )

    assert Repo.exists?(
             from(audit in AuditLog,
               where:
                 audit.community_id == ^community.id and audit.action == "community.destroyed"
             )
           )
  end

  test "moderation and legal blockers prevent reclaim" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)

    assert {:ok, _archive} =
             Lifecycle.request_destroy(community.slug,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _blocker} =
             Lifecycle.apply_blocker(
               community.slug,
               %{blocker_type: :ops_legal_hold, cause_code: "legal_hold"},
               operation_ref: Ecto.UUID.generate()
             )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :destroy_blocked}} =
             Lifecycle.schedule_destroy(community.slug, operation_ref: Ecto.UUID.generate())
  end
end
