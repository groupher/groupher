defmodule GroupherServer.Test.CMS.OutboxRecoveryContractTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{CommunityAsset, GlobalPassport}
  alias CMS.Outbox.{Event, Recovery, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {:ok, community} = db_insert(:community)
    {:ok, root} = db_insert(:user)
    Repo.insert!(GlobalPassport.changeset(%GlobalPassport{}, %{user_id: root.id, is_root: true}))
    %{community: community, root: root}
  end

  test "manual recovery rejects stale deletion targets without touching event, jobs or audit",
       ctx do
    for state <- [:active, :archived, :missing_deleted_at, :wrong_object, :missing] do
      asset = asset(ctx.community)
      event = dead_event(asset)

      case state do
        :active ->
          Repo.update!(Ecto.Changeset.change(asset, status: :active, deleted_at: nil))

        :archived ->
          Repo.update!(Ecto.Changeset.change(asset, status: :archived, deleted_at: nil))

        :missing_deleted_at ->
          Repo.update!(Ecto.Changeset.change(asset, deleted_at: nil))

        :wrong_object ->
          Repo.update!(Ecto.Changeset.change(asset, storage_key: "different-object"))

        :missing ->
          Repo.delete!(asset)
      end

      assert_unchanged(event, fn ->
        assert {:error, %{reason: :provider_delete_target_invalid}} =
                 with_jobs(fn ->
                   CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated")
                 end)
      end)
    end
  end

  test "both recovery initiators reject an unsupported payload version", ctx do
    asset = asset(ctx.community)
    event = dead_event(asset)
    event = Repo.update!(Ecto.Changeset.change(event, contract_version: 99))

    assert_unchanged(event, fn ->
      assert {:error, {:outbox_contract_version_conflict, id}} =
               with_jobs(fn -> CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated") end)

      assert id == event.id

      assert {:error, {:outbox_contract_version_conflict, ^id}} =
               with_jobs(fn ->
                 Recovery.requeue(
                   event.id,
                   1,
                   Ecto.UUID.generate(),
                   GroupherServer.Jobs.CMSOutboxAsset,
                   %{
                     initiator_kind: "owner",
                     owner_ref: "provider-reconciliation:test",
                     reason_code: "provider_delete_retry"
                   }
                 )
               end)
    end)
  end

  test "recovery refuses a missing payload field and a changed worker route", ctx do
    asset = asset(ctx.community)
    event = dead_event(asset)

    event =
      Repo.update!(Ecto.Changeset.change(event, data: Map.delete(event.data, "storage_key")))

    assert_unchanged(event, fn ->
      assert {:error, {:outbox_payload_field_missing, "storage_key"}} =
               with_jobs(fn -> CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated") end)
    end)

    event =
      Repo.update!(
        Ecto.Changeset.change(event,
          data: Map.put(event.data, "storage_key", asset.storage_key),
          worker: "GroupherServer.Jobs.CMSOutboxArticle"
        )
      )

    assert_unchanged(event, fn ->
      assert {:error, :outbox_worker_invalid} =
               with_jobs(fn -> CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated") end)
    end)
  end

  test "valid deleted target can be requeued and delivery rechecks the same owner guard", ctx do
    asset = asset(ctx.community)
    event = dead_event(asset)

    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn -> CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated") end)

    Repo.update!(Ecto.Changeset.change(asset, status: :active, deleted_at: nil))
    job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 20}
    assert {:ok, :pass} = GroupherServer.Jobs.CMSOutboxAsset.perform(job)
    delivered = Repo.get!(Event, event.id)
    assert delivered.status == :failed
    assert delivered.failure_generation == 2
    assert delivered.last_error_code == "5605"
    assert delivered.completed_at == nil
  end

  test "an existing available or executing job prevents a second wakeup", ctx do
    for state <- ["available", "scheduled", "retryable", "executing"] do
      asset = asset(ctx.community)
      event = dead_event(asset)
      {:ok, job} = GroupherServer.Jobs.CMSOutboxAsset.new(%{event_id: event.id}) |> Repo.insert()
      Repo.update!(Ecto.Changeset.change(job, state: state))

      assert_unchanged(event, fn ->
        assert {:error, :outbox_recovery_job_busy} =
                 with_jobs(fn ->
                   CMS.retry_outbox_event(event.id, 1, ctx.root, "investigated")
                 end)
      end)
    end
  end

  test "the primitive refuses a worker that differs from the persisted route", ctx do
    event = ctx.community |> asset() |> dead_event()

    assert_unchanged(event, fn ->
      assert {:error, :outbox_worker_invalid} =
               with_jobs(fn ->
                 Recovery.requeue(
                   event.id,
                   1,
                   Ecto.UUID.generate(),
                   GroupherServer.Jobs.CMSOutboxArticle,
                   %{initiator_kind: "user", actor_id: ctx.root.id, reason: "investigated"}
                 )
               end)
    end)
  end

  test "automatic recovery requires the live run and step lease for this exact operation", ctx do
    asset = asset(ctx.community)
    event = dead_event(asset)
    workflow_ref = "recovery-lease:#{Ecto.UUID.generate()}"
    owner = "lease-owner:#{Ecto.UUID.generate()}"

    {:ok, run} =
      CMS.Assets.Workflow.ensure_run(%{
        workflow_ref: workflow_ref,
        workflow_type: "provider_reconciliation",
        community_id: ctx.community.id,
        resource_type: "community",
        resource_id: to_string(ctx.community.id),
        status: :pending
      })

    {:ok, run} = CMS.Assets.Workflow.claim_run(run, owner)

    {:ok, step} =
      CMS.Assets.Workflow.ensure_step(run, %{
        step_ref: "asset:#{asset.id}",
        resource_type: "community_asset",
        resource_id: to_string(asset.id),
        status: :pending,
        attempts: 0,
        payload: %{asset_id: asset.id, public_ref: asset.public_ref},
        result: %{}
      })

    {:ok, step} = CMS.Assets.Workflow.claim_step(step, owner)

    recover = fn operation_ref, lease_owner ->
      with_jobs(fn ->
        Recovery.requeue(event.id, 1, operation_ref, GroupherServer.Jobs.CMSOutboxAsset, %{
          initiator_kind: "owner",
          owner_ref: "provider-reconciliation:#{workflow_ref}",
          reason_code: "provider_delete_retry",
          lease_owner: lease_owner
        })
      end)
    end

    assert_unchanged(event, fn ->
      assert {:error, :provider_delete_recovery_lease_invalid} =
               recover.(step.operation_ref, "other-owner")

      assert {:error, :provider_delete_recovery_lease_invalid} =
               recover.(Ecto.UUID.generate(), owner)
    end)

    expired = DateTime.add(DateTime.utc_now(:second), -60, :second)
    Repo.update!(Ecto.Changeset.change(step, lease_expires_at: expired))

    assert_unchanged(event, fn ->
      assert {:error, :provider_delete_recovery_lease_invalid} =
               recover.(step.operation_ref, owner)
    end)

    Repo.update!(
      Ecto.Changeset.change(step, lease_expires_at: DateTime.add(expired, 3600, :second))
    )

    Repo.update!(Ecto.Changeset.change(run, lease_expires_at: expired))

    assert_unchanged(event, fn ->
      assert {:error, :provider_delete_recovery_lease_invalid} =
               recover.(step.operation_ref, owner)
    end)
  end

  test "application upload cleanup must still own an expired provider object", ctx do
    ref = Ecto.UUID.generate()

    upload =
      Repo.insert!(
        CMS.Model.CommunityApplicationLogoUpload.changeset(
          %CMS.Model.CommunityApplicationLogoUpload{},
          %{
            public_ref: "upload_#{ref}",
            user_id: ctx.root.id,
            filename: "logo.png",
            mime_type: "image/png",
            size_bytes: 1,
            status: :expired,
            expires_at: DateTime.add(DateTime.utc_now(:second), -60, :second),
            storage: "r2",
            storage_key: "expired/#{ref}"
          }
        )
      )

    {:ok, event} =
      Repo.transact_result(fn ->
        CMS.Assets.Effects.enqueue_application_upload_delete(upload, Ecto.UUID.generate())
      end)

    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :provider_unavailable} end,
               on_error: :fail
             )

    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(event.id, 1, ctx.root, "expired upload cleanup")
             end)

    Repo.update!(Ecto.Changeset.change(upload, status: :promoted))

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 20
             })

    current = Repo.get!(Event, event.id)
    assert current.status == :failed
    assert current.failure_generation == 2
    assert current.last_error_code == "5605"

    assert_unchanged(current, fn ->
      assert {:error, %{reason: :provider_delete_target_invalid}} =
               with_jobs(fn ->
                 CMS.retry_outbox_event(event.id, 2, ctx.root, "object was promoted")
               end)
    end)
  end

  defp asset(community) do
    ref = Ecto.UUID.generate()

    Repo.insert!(
      CommunityAsset.changeset(%CommunityAsset{}, %{
        community_id: community.id,
        url: "https://assets.test/#{ref}",
        size_bytes: 1,
        storage: "r2",
        storage_key: "recovery/#{ref}",
        public_ref: "asset_#{ref}",
        status: :deleted,
        deleted_at: DateTime.utc_now(:second)
      })
    )
  end

  defp dead_event(asset) do
    {:ok, event} =
      Repo.transact_result(fn ->
        CMS.Assets.Effects.enqueue_provider_delete(asset, Ecto.UUID.generate())
      end)

    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :provider_unavailable} end,
               on_error: :fail
             )

    Repo.get!(Event, event.id)
  end

  defp assert_unchanged(event, action) do
    jobs = Repo.all(Oban.Job)
    retries = Repo.all(Retry)
    runs = Repo.all(CMS.Model.AssetWorkflowRun)
    steps = Repo.all(CMS.Model.AssetWorkflowStep)
    action.()
    assert Repo.get!(Event, event.id) == event
    assert Repo.all(Oban.Job) == jobs
    assert Repo.all(Retry) == retries
    assert Repo.all(CMS.Model.AssetWorkflowRun) == runs
    assert Repo.all(CMS.Model.AssetWorkflowStep) == steps
  end

  defp with_jobs(action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end
end
