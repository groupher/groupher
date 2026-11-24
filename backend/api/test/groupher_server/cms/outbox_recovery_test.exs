defmodule GroupherServer.Test.CMS.OutboxRecoveryTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Outbox
  alias Outbox.{Event, Recovery, Retry}
  alias CMS.Model.GlobalPassport

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    :ok
  end

  test "requeues a dead generation once and retains both operation identities" do
    {:ok, event} = send_event()

    assert {:error, %ErrorCat.Error{reason: :outbox_delivery_exhausted}} =
             Outbox.execute(event.id, fn _event -> {:error, :permanent_failure} end,
               on_error: :fail
             )

    assert %Event{status: :failed, failure_generation: 1} = Repo.get!(Event, event.id)

    with_jobs_enabled(fn ->
      retry_operation_ref = Ecto.UUID.generate()

      assert {:ok, %{outcome: :requeued, event: %Event{status: :waiting}}} =
               Recovery.requeue(
                 event.id,
                 1,
                 retry_operation_ref,
                 GroupherServer.Jobs.CMSOutboxArticle,
                 %{initiator_kind: "user", actor_id: 1, reason: "retry after provider recovery"}
               )

      assert %Retry{
               failure_generation: 1,
               original_operation_ref: original_operation_ref,
               retry_operation_ref: ^retry_operation_ref,
               failed_error_code: "permanent_failure"
             } = Repo.get_by!(Retry, event_id: event.id, failure_generation: 1)

      assert original_operation_ref == event.operation_ref
      assert original_operation_ref != retry_operation_ref

      assert {:error, :outbox_recovery_stale_generation} =
               Recovery.requeue(
                 event.id,
                 2,
                 Ecto.UUID.generate(),
                 GroupherServer.Jobs.CMSOutboxArticle,
                 %{initiator_kind: "user", actor_id: 1, reason: "stale retry"}
               )

      assert {:ok, %{outcome: :already_retried}} =
               Recovery.requeue(
                 event.id,
                 1,
                 Ecto.UUID.generate(),
                 GroupherServer.Jobs.CMSOutboxArticle,
                 %{initiator_kind: "user", actor_id: 1, reason: "duplicate retry"}
               )

      assert Repo.aggregate(
               from(retry in Retry, where: retry.event_id == ^event.id),
               :count,
               :event_id
             ) == 1
    end)
  end

  test "manual recovery requires a current system root and a nonblank reason" do
    {:ok, event} = send_event()
    fail_event(event)

    {:ok, stale_root} = db_insert(:user)

    stale_root = Map.put(stale_root, :cur_passport, %{"global" => %{"god" => true}})

    assert {:error, :permission_denied} =
             CMS.retry_outbox_event(event.id, 1, stale_root, "retry after investigation")

    root = create_root()

    assert {:error, :outbox_retry_reason_required} =
             CMS.retry_outbox_event(event.id, 1, root, "  ")

    assert %Event{status: :failed, failure_generation: 1} = Repo.get!(Event, event.id)
    assert Repo.get_by(Retry, event_id: event.id) == nil
  end

  test "manual recovery uses a fresh direct operation ref and fences duplicate generations" do
    {:ok, event} = send_event()
    fail_event(event)
    root = create_root()

    with_jobs_enabled(fn ->
      assert {:ok, %{outcome: :requeued, event: %Event{status: :waiting}}} =
               CMS.retry_outbox_event(event.id, 1, root, "provider incident resolved")

      assert {:ok, %{outcome: :already_retried}} =
               CMS.retry_outbox_event(event.id, 1, root, "repeat request")

      assert {:error, %ErrorCat.Error{reason: :outbox_delivery_exhausted}} =
               Outbox.execute(event.id, fn _event -> {:error, :permanent_failure} end,
                 on_error: :fail
               )

      assert %Event{status: :failed, failure_generation: 2} = Repo.get!(Event, event.id)

      Repo.update_all(
        from(job in Oban.Job, where: job.args["event_id"] == ^event.id),
        set: [state: "completed", completed_at: DateTime.utc_now(:second)]
      )

      assert {:error, :outbox_recovery_stale_generation} =
               CMS.retry_outbox_event(event.id, 1, root, "old generation")

      assert {:ok, %{outcome: :requeued, event: %Event{status: :waiting}}} =
               CMS.retry_outbox_event(event.id, 2, root, "second failure handled")

      assert %Retry{
               initiator_kind: "user",
               actor_id: actor_id,
               reason: "provider incident resolved",
               original_operation_ref: original_operation_ref,
               retry_operation_ref: retry_operation_ref
             } = Repo.get_by!(Retry, event_id: event.id, failure_generation: 1)

      assert actor_id == root.id
      assert original_operation_ref == event.operation_ref
      assert retry_operation_ref != original_operation_ref

      assert Repo.aggregate(
               from(retry in Retry, where: retry.event_id == ^event.id),
               :count,
               :event_id
             ) == 2
    end)
  end

  test "manual recovery reports skipped enqueue as an error without resetting or recording" do
    {:ok, event} = send_event()
    fail_event(event)
    root = create_root()

    with_jobs_skipped(fn ->
      assert {:error, :enqueue_disabled} =
               CMS.retry_outbox_event(event.id, 1, root, "enqueue disabled in test")

      assert %Event{status: :failed, failure_generation: 1} = Repo.get!(Event, event.id)
      assert Repo.get_by(Retry, event_id: event.id) == nil
      refute Repo.exists?(from(job in Oban.Job, where: job.args["event_id"] == ^event.id))
    end)
  end

  defp send_event do
    operation_ref = Ecto.UUID.generate()

    attrs = %{
      event: "article.updated",
      worker: GroupherServer.Jobs.CMSOutboxArticle,
      resource_type: "article",
      resource_id: Ecto.UUID.generate(),
      operation_ref: operation_ref,
      dedupe_key: "outbox-recovery-test-#{operation_ref}",
      data: %{
        community: "test",
        community_id: 1,
        thread: :post,
        inner_id: 1,
        article_id: Ecto.UUID.generate(),
        snapshot_id: Ecto.UUID.generate()
      }
    }

    case Repo.transaction(fn -> Outbox.send(attrs) end) do
      {:ok, {:ok, event}} -> {:ok, event}
      {:ok, {:error, reason}} -> {:error, reason}
      {:error, reason} -> {:error, reason}
    end
  end

  defp fail_event(event) do
    assert {:error, %ErrorCat.Error{reason: :outbox_delivery_exhausted}} =
             Outbox.execute(event.id, fn _event -> {:error, :permanent_failure} end,
               on_error: :fail
             )
  end

  defp create_root do
    {:ok, user} = db_insert(:user)

    Repo.insert!(
      GlobalPassport.changeset(%GlobalPassport{}, %{
        user_id: user.id,
        is_root: true,
        permissions: %{}
      })
    )

    user
  end

  defp with_jobs_enabled(action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end

  defp with_jobs_skipped(action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :test)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end
end
