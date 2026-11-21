defmodule GroupherServer.Test.CMS.OutboxScheduleCheckTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs}
  alias Ecto.Adapters.SQL.Sandbox
  alias CMS.Outbox.{Event, ScheduleCheck, ScheduleConfig}
  alias Jobs.CMSOutboxArticle

  setup do
    Repo.update_all(
      from(event in Event, where: event.status in [:waiting, :retrying, :running]),
      set: [status: :done, locked_at: nil, locked_by: nil]
    )

    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    :ok
  end

  test "skip-enqueue reports skipped and does not scan or repair" do
    {:ok, event} = send_event()
    make_stale(event, DateTime.add(DateTime.utc_now(:second), -600, :second))

    assert {:ok,
            %{
              outcome: :skipped,
              reason: :enqueue_disabled,
              scanned: 0,
              schedule_missing: 0
            }} = ScheduleCheck.reconcile()

    assert jobs_for(event) == []

    assert {:ok,
            %{
              outcome: :skipped,
              reason: :enqueue_disabled,
              scanned: 0,
              schedule_missing: 0
            }} = with_env(:seed_prod, &ScheduleCheck.reconcile/0)

    assert jobs_for(event) == []
  end

  test "repairs a missing stale wakeup and preserves event identity and payload" do
    {:ok, event} = send_event()
    stale_since = DateTime.add(DateTime.utc_now(:second), -600, :second)
    make_stale(event, stale_since)

    assert {:ok,
            %{
              outcome: :checked,
              scanned: 1,
              schedule_missing: 1,
              repaired: 1
            }} = with_jobs_enabled(&ScheduleCheck.reconcile/0)

    assert [%Oban.Job{worker: worker, args: %{"event_id" => event_id}}] = jobs_for(event)
    assert worker == inspect(CMSOutboxArticle)
    assert event_id == event.id

    assert %Event{
             status: :waiting,
             operation_ref: operation_ref,
             dedupe_key: dedupe_key,
             worker: worker_name,
             data: data,
             available_at: ^stale_since
           } = Repo.get!(Event, event.id)

    assert operation_ref == event.operation_ref
    assert dedupe_key == event.dedupe_key
    assert worker_name == inspect(CMSOutboxArticle)
    assert data == event.data
  end

  test "repairs retrying events only after available_at exceeds the grace period" do
    {:ok, event} = send_event()
    now = DateTime.utc_now(:second)
    stale_after_seconds = ScheduleConfig.stale_after_seconds()

    event
    |> Event.changeset(%{
      status: :retrying,
      available_at: DateTime.add(now, -stale_after_seconds - 2, :second)
    })
    |> Repo.update!()

    assert {:ok, %{outcome: :checked, schedule_missing: 1, repaired: 1}} =
             with_jobs_enabled(&ScheduleCheck.reconcile/0)

    assert Repo.get!(Event, event.id).status == :retrying
    assert length(jobs_for(event)) == 1
  end

  test "does not duplicate an active job or wake an event with a valid lease" do
    {:ok, queued_event} = with_jobs_enabled(fn -> send_event() end)
    make_stale(queued_event, DateTime.add(DateTime.utc_now(:second), -600, :second))

    assert {:ok, %{outcome: :checked, schedule_missing: 0, repaired: 0}} =
             with_jobs_enabled(&ScheduleCheck.reconcile/0)

    assert length(jobs_for(queued_event)) == 1

    {:ok, leased_event} = send_event()
    now = DateTime.utc_now(:second)

    leased_event
    |> Event.changeset(%{
      status: :running,
      locked_at: now,
      locked_by: "schedule-check-test",
      available_at: DateTime.add(now, -600, :second)
    })
    |> Repo.update!()

    assert {:ok, %{outcome: :checked, scanned: 0, schedule_missing: 0, repaired: 0}} =
             with_jobs_enabled(&ScheduleCheck.reconcile/0)

    assert jobs_for(leased_event) == []
  end

  test "waits through the lease plus grace before recovering a running event" do
    {:ok, event} = send_event()
    now = DateTime.utc_now(:second)
    stale_after_seconds = ScheduleConfig.stale_after_seconds()
    expired_locked_at = DateTime.add(now, -120 - stale_after_seconds - 2, :second)

    event
    |> Event.changeset(%{
      status: :running,
      locked_at: expired_locked_at,
      locked_by: "expired-schedule-check-test",
      available_at: now
    })
    |> Repo.update!()

    assert {:ok, %{outcome: :checked, schedule_missing: 1, repaired: 1}} =
             with_jobs_enabled(&ScheduleCheck.reconcile/0)

    assert %Event{status: :running, locked_at: ^expired_locked_at} = Repo.get!(Event, event.id)
    assert length(jobs_for(event)) == 1
  end

  test "observes the stale boundary and bounds configured grace values" do
    with_stale_after_seconds(181, fn ->
      {:ok, before_boundary} = send_event()
      now = DateTime.utc_now(:second)
      make_stale(before_boundary, DateTime.add(now, -179, :second))

      assert {:ok, %{outcome: :checked, schedule_missing: 0, repaired: 0}} =
               with_jobs_enabled(&ScheduleCheck.reconcile/0)

      {:ok, at_boundary} = send_event()
      make_stale(at_boundary, DateTime.add(now, -181, :second))

      assert {:ok, %{outcome: :checked, schedule_missing: 1, repaired: 1}} =
               with_jobs_enabled(&ScheduleCheck.reconcile/0)
    end)

    assert_raise ArgumentError, fn ->
      with_stale_after_seconds(180, fn -> ScheduleConfig.stale_after_seconds() end)
    end

    assert_raise ArgumentError, fn ->
      with_stale_after_seconds(86_401, fn -> ScheduleConfig.stale_after_seconds() end)
    end
  end

  @tag timeout: 60_000
  test "concurrent checks create only one wakeup for a missing event" do
    previous_env = Application.get_env(:groupher_server, :env)

    with_env(:dev, fn ->
      {:ok, event} = committed_event()
      on_exit(fn -> cleanup_committed_event(event, previous_env) end)

      committed_update(event, %{
        available_at: DateTime.add(DateTime.utc_now(:second), -600, :second)
      })

      committed_delete_jobs(event)

      tasks =
        Enum.map(1..2, fn _ ->
          Task.async(fn -> Sandbox.unboxed_run(Repo, &ScheduleCheck.reconcile/0) end)
        end)

      results = Enum.map(tasks, &Task.await(&1, 10_000))

      assert Enum.all?(results, &match?({:ok, %{outcome: :checked}}, &1))
      assert Enum.sum(Enum.map(results, fn {:ok, result} -> result.schedule_missing end)) == 1
      assert Enum.sum(Enum.map(results, fn {:ok, result} -> result.repaired end)) == 1
      assert length(committed_jobs_for(event)) == 1
    end)
  end

  defp send_event do
    operation_ref = Ecto.UUID.generate()

    attrs = %{
      event: "article.updated",
      worker: CMSOutboxArticle,
      resource_type: "article",
      resource_id: Ecto.UUID.generate(),
      operation_ref: operation_ref,
      dedupe_key: "schedule-check-test-#{operation_ref}",
      data: %{
        community: "schedule-check-test",
        community_id: 1,
        thread: :post,
        inner_id: 1,
        article_id: Ecto.UUID.generate(),
        snapshot_id: Ecto.UUID.generate()
      }
    }

    case Repo.transaction(fn -> GroupherServer.CMS.Outbox.send(attrs) end) do
      {:ok, {:ok, event}} -> {:ok, event}
      {:ok, {:error, reason}} -> {:error, reason}
      {:error, reason} -> {:error, reason}
    end
  end

  defp make_stale(event, available_at) do
    event
    |> Event.changeset(%{available_at: available_at})
    |> Repo.update!()
  end

  defp jobs_for(event) do
    Repo.all(
      from(job in Oban.Job,
        where: job.args["event_id"] == ^event.id,
        order_by: [asc: job.id]
      )
    )
  end

  defp with_jobs_enabled(action) do
    with_env(:dev, action)
  end

  defp with_env(env, action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, env)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end

  defp with_stale_after_seconds(value, action) do
    config = Application.get_env(:groupher_server, ScheduleConfig, [])

    Application.put_env(
      :groupher_server,
      ScheduleConfig,
      outbox_schedule_stale_after_seconds: value
    )

    try do
      action.()
    after
      Application.put_env(:groupher_server, ScheduleConfig, config)
    end
  end

  defp committed_event do
    attrs = %{
      event: "article.updated",
      worker: CMSOutboxArticle,
      resource_type: "article",
      resource_id: Ecto.UUID.generate(),
      operation_ref: Ecto.UUID.generate(),
      dedupe_key: "schedule-check-concurrency-#{Ecto.UUID.generate()}",
      data: %{
        community: "schedule-check-concurrency",
        community_id: 1,
        thread: :post,
        inner_id: 1,
        article_id: Ecto.UUID.generate(),
        snapshot_id: Ecto.UUID.generate()
      }
    }

    Sandbox.unboxed_run(Repo, fn ->
      Repo.transact_result(fn -> GroupherServer.CMS.Outbox.send(attrs) end)
    end)
  end

  defp committed_update(event, attrs) do
    Sandbox.unboxed_run(Repo, fn ->
      Repo.get!(Event, event.id)
      |> Event.changeset(attrs)
      |> Repo.update!()
    end)
  end

  defp committed_delete_jobs(event) do
    Sandbox.unboxed_run(Repo, fn ->
      Repo.delete_all(from(job in Oban.Job, where: job.args["event_id"] == ^event.id))
    end)
  end

  defp committed_jobs_for(event) do
    Sandbox.unboxed_run(Repo, fn ->
      Repo.all(from(job in Oban.Job, where: job.args["event_id"] == ^event.id))
    end)
  end

  defp cleanup_committed_event(event, previous_env) do
    Application.put_env(:groupher_server, :env, :dev)

    Sandbox.unboxed_run(Repo, fn ->
      Repo.delete_all(from(job in Oban.Job, where: job.args["event_id"] == ^event.id))
      Repo.delete_all(from(row in Event, where: row.id == ^event.id))
    end)

    Application.put_env(:groupher_server, :env, previous_env)
  end
end
