defmodule GroupherServer.Test.CMS.Assets.RestoreEffectSafetyTest do
  use GroupherServer.TestMate, async: false

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.CMS
  alias CMS.Assets.Deletion
  alias CMS.Model.{CommandReceipt, CommunityAsset}
  alias CMS.Outbox.{Event, Retry}

  defmodule SendBarrier do
    @moduledoc false
    @behaviour Tesla.Adapter

    @impl true
    def call(env, options) do
      send(Keyword.fetch!(options, :parent), {:before_provider_send, self(), env.body})

      receive do
        :send_provider_request -> Tesla.Adapter.Finch.call(env, name: GroupherServer.Finch)
      after
        8_000 -> {:error, :test_send_barrier_timeout}
      end
    end
  end

  defmodule Endpoint do
    @moduledoc false
    import Plug.Conn
    def init(options), do: options

    def call(conn, options) do
      {:ok, body, conn} = read_body(conn)
      send(Keyword.fetch!(options, :parent), {:provider_received, Jason.decode!(body)})

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(200, ~s({"ok":true,"result":{"enqueued":true}}))
    end
  end

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    :ok
  end

  for status <- [:waiting, :running, :retrying, :done, :failed] do
    @status status
    test "Restore rejects a deleted asset with a #{@status} intent without changing durable facts" do
      f = fixture()
      delete_id = Ecto.UUID.generate()
      assert {:ok, %{status: :deleted}} = delete_asset(f, delete_id)
      event = event_for(f)
      finish = advance(event, @status)

      try do
        assert Repo.get!(Event, event.id).status == @status
        before = facts(f)
        restore_id = Ecto.UUID.generate()

        for _ <- 1..2 do
          assert_restore_rejected(f, restore_id)
          assert facts(f) == before
          refute Repo.get_by(CommandReceipt, command_id: restore_id)
        end

        receipt = Repo.get_by!(CommandReceipt, command_id: delete_id)
        assert Repo.get!(Event, event.id).operation_ref == receipt.operation_ref
      after
        finish.()
      end
    end
  end

  test "successful Restore replay returns its Confirmation without executing another restoration" do
    f = fixture()
    assert {:ok, %{status: :archived}} = archive_asset(f)
    restore_id = Ecto.UUID.generate()
    assert {:ok, %{status: :active}} = restore_asset(f, restore_id)
    receipt = Repo.get_by!(CommandReceipt, command_id: restore_id)
    assert {:ok, %{status: :archived}} = archive_asset(f)
    before = facts(f)
    assert {:ok, %{status: :archived, command_id: ^restore_id}} = restore_asset(f, restore_id)
    assert Repo.get!(CommandReceipt, receipt.id) == receipt
    assert facts(f) == before
  end

  for first_action <- [:delete, :restore] do
    @first_action first_action
    @tag timeout: 60_000
    test "#{first_action} holds the real row lock before the competing Command" do
      with_committed_fixture(fn f ->
        first_id = Ecto.UUID.generate()
        second_id = Ecto.UUID.generate()
        second_action = if @first_action == :delete, do: :restore, else: :delete

        if @first_action == :restore do
          assert {:ok, %{status: :archived}} =
                   Sandbox.unboxed_run(Repo, fn -> archive_asset(f) end)
        end

        parent = self()

        first =
          start_task(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transact_result(fn ->
                {:ok, result} = command(@first_action, f, first_id)
                [[backend]] = Repo.query!("SELECT pg_backend_pid()").rows
                send(parent, {:held, self(), backend})

                receive do
                  :commit_first -> {:ok, result}
                after
                  10_000 -> {:error, :test_commit_barrier_timeout}
                end
              end)
            end)
          end)

        on_exit(fn -> stop_task(first) end)
        assert_receive {:held, holder, first_backend}, 10_000

        second =
          start_task(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transact_result(fn ->
                [[backend]] = Repo.query!("SELECT pg_backend_pid()").rows
                send(parent, {:competing, backend})
                command(second_action, f, second_id)
              end)
            end)
          end)

        on_exit(fn -> stop_task(second) end)
        assert_receive {:competing, second_backend}, 10_000
        assert_blocked_by(second_backend, first_backend)
        send(holder, :commit_first)
        assert {:ok, _} = Task.await(first, 15_000)
        result = Task.await(second, 15_000)

        if second_action == :restore do
          assert {:error, %{reason: :asset_not_restorable}} = result
          refute Repo.get_by(CommandReceipt, command_id: second_id)
        else
          assert {:ok, %{status: :deleted}} = result
        end

        assert %{status: :deleted, deleted_at: %DateTime{}} =
                 Repo.get!(CommunityAsset, f.asset.id)

        event = event_for(f)
        delete_id = if @first_action == :delete, do: first_id, else: second_id
        receipt = Repo.get_by!(CommandReceipt, command_id: delete_id)
        assert event.operation_ref == receipt.operation_ref
        assert event.status == :waiting

        assert Repo.aggregate(from(j in Oban.Job, where: j.args["event_id"] == ^event.id), :count) ==
                 1

        refute Repo.exists?(from(r in Retry, where: r.event_id == ^event.id))
      end)
    end
  end

  @tag timeout: 60_000
  test "Restore cannot reactivate the frozen target after worker validation and before HTTP send" do
    with_committed_fixture(fn f ->
      assert {:ok, %{status: :deleted}} =
               Sandbox.unboxed_run(Repo, fn -> delete_asset(f, Ecto.UUID.generate()) end)

      event = event_for(f)

      with_http_barrier(fn ->
        delivery =
          start_task(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
                args: %{"event_id" => event.id},
                attempt: 1,
                max_attempts: 8
              })
            end)
          end)

        on_exit(fn -> stop_task(delivery) end)
        assert_receive {:before_provider_send, sender, body}, 10_000
        assert Jason.decode!(body)["storageKey"] == f.asset.storage_key
        assert Repo.get!(Event, event.id).status == :running
        before = facts(f)
        restore_id = Ecto.UUID.generate()
        Sandbox.unboxed_run(Repo, fn -> assert_restore_rejected(f, restore_id) end)
        assert facts(f) == before
        refute Repo.get_by(CommandReceipt, command_id: restore_id)
        refute_received {:provider_received, _}
        send(sender, :send_provider_request)
        assert_receive {:provider_received, payload}, 5_000
        assert payload["assetId"] == f.asset.id
        assert payload["assetPublicRef"] == f.asset.public_ref
        assert payload["storageKey"] == f.asset.storage_key
        assert {:ok, :pass} = Task.await(delivery, 10_000)
        delivered = Repo.get!(Event, event.id)
        assert delivered.status == :done

        assert Map.take(delivered, [
                 :id,
                 :operation_ref,
                 :dedupe_key,
                 :contract_version,
                 :worker,
                 :resource_type,
                 :resource_id,
                 :data
               ]) ==
                 Map.take(event, [
                   :id,
                   :operation_ref,
                   :dedupe_key,
                   :contract_version,
                   :worker,
                   :resource_type,
                   :resource_id,
                   :data
                 ])

        assert Repo.get!(CommunityAsset, f.asset.id) == before.asset
        refute Repo.exists?(from(r in Retry, where: r.event_id == ^event.id))
      end)
    end)
  end

  defp fixture do
    {community, _post, _attrs, actor} = mock_article(:post)
    ref = Ecto.UUID.generate()

    assert {:ok, asset} =
             CMS.Assets.register_to_community(
               community,
               %{
                 url: "https://assets.test/#{ref}.png",
                 filename: "restore.png",
                 mime_type: "image/png",
                 size_bytes: 64,
                 storage: "r2",
                 storage_key: "restore-safety/#{ref}"
               },
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _} = CMS.Assets.backfill_usage(community)
    %{community: community, actor: actor, asset: asset}
  end

  defp with_committed_fixture(action) do
    initial = Sandbox.unboxed_run(Repo, fn -> baseline() end)
    f = Sandbox.unboxed_run(Repo, fn -> fixture() end)

    try do
      action.(f)
    after
      for task <- Process.get({__MODULE__, :tasks}, []) do
        Task.shutdown(task, :brutal_kill)
      end

      Sandbox.unboxed_run(Repo, fn -> cleanup(f, initial) end)
    end
  end

  defp start_task(action) do
    task = Task.async(action)
    Process.put({__MODULE__, :tasks}, [task | Process.get({__MODULE__, :tasks}, [])])
    task
  end

  defp baseline do
    %{
      jobs: Repo.all(from(j in Oban.Job, select: j.id)),
      events: Repo.all(from(e in Event, select: e.id)),
      receipts: Repo.all(from(r in CommandReceipt, select: r.id))
    }
  end

  defp cleanup(f, initial) do
    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(f.community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )

    current = baseline()
    new_events = current.events -- initial.events
    Repo.delete_all(from(j in Oban.Job, where: j.id in ^(current.jobs -- initial.jobs)))
    Repo.delete_all(from(r in Retry, where: r.event_id in ^new_events))
    Repo.delete_all(from(e in Event, where: e.id in ^new_events))

    Repo.delete_all(
      from(r in CommandReceipt, where: r.id in ^(current.receipts -- initial.receipts))
    )
  end

  defp facts(f) do
    %{
      asset: Repo.get!(CommunityAsset, f.asset.id),
      events:
        Repo.all(
          from(e in Event,
            where:
              e.resource_type == "community_asset" and e.resource_id == ^to_string(f.asset.id),
            order_by: e.id
          )
        ),
      jobs: Repo.all(from(j in Oban.Job, order_by: j.id)),
      retries: Repo.all(from(r in Retry, order_by: r.id)),
      receipts: Repo.all(from(r in CommandReceipt, order_by: r.id))
    }
  end

  defp event_for(f) do
    Repo.one!(
      from(e in Event,
        where: e.event == "asset.provider_delete" and e.resource_id == ^to_string(f.asset.id)
      )
    )
  end

  defp command(:delete, f, command_id), do: delete_asset(f, command_id)
  defp command(:restore, f, command_id), do: restore_asset(f, command_id)

  defp delete_asset(f, command_id) do
    CMS.Assets.delete(f.community, f.asset.id, f.actor, command_id)
  end

  defp restore_asset(f, command_id) do
    CMS.Assets.restore(f.community, f.asset.id, f.actor, command_id)
  end

  defp archive_asset(f) do
    CMS.Assets.archive(f.community, f.asset.id, f.actor, Ecto.UUID.generate())
  end

  defp assert_restore_rejected(f, command_id) do
    assert {:error, %{code: 5606, reason: :asset_not_restorable, retryable: false}} =
             restore_asset(f, command_id)
  end

  defp advance(_event, :waiting), do: fn -> :ok end

  defp advance(event, :running) do
    parent = self()

    task =
      start_task(fn ->
        CMS.Outbox.execute(event.id, fn _ ->
          send(parent, {:running_fixture, self()})

          receive do
            :finish_fixture -> {:ok, :fixture_delivered}
          after
            10_000 -> {:error, :test_fixture_timeout}
          end
        end)
      end)

    on_exit(fn -> stop_task(task) end)
    assert_receive {:running_fixture, pid}, 5_000

    fn ->
      send(pid, :finish_fixture)
      assert {:ok, :fixture_delivered} = Task.await(task, 5_000)
    end
  end

  defp advance(event, status) do
    if status == :done do
      assert {:ok, :fixture_delivered} =
               CMS.Outbox.execute(event.id, fn _ -> {:ok, :fixture_delivered} end)
    else
      assert {:error, _} =
               CMS.Outbox.execute(
                 event.id,
                 fn _ -> {:error, CMS.Assets.ErrorCat.delete_enqueue_failed(%{status: 503})} end,
                 on_error: if(status == :failed, do: :fail, else: :classify)
               )
    end

    fn -> :ok end
  end

  defp assert_blocked_by(backend, holder) do
    deadline = System.monotonic_time(:millisecond) + 5_000
    wait_for_block(backend, holder, deadline)
  end

  defp wait_for_block(backend, holder, deadline) do
    [[blockers]] = Repo.query!("SELECT pg_blocking_pids($1)", [backend]).rows

    cond do
      holder in blockers ->
        :ok

      System.monotonic_time(:millisecond) >= deadline ->
        flunk("competing Command did not wait for the held database lock")

      true ->
        Process.sleep(10)
        wait_for_block(backend, holder, deadline)
    end
  end

  defp with_http_barrier(action) do
    ref = Module.concat(__MODULE__, "Endpoint#{System.unique_integer([:positive])}")
    {:ok, _} = Plug.Cowboy.http(Endpoint, [parent: self()], port: 0, ref: ref)
    endpoint = System.get_env("ASSETS_HUB_DELETE_ENDPOINT")
    adapter = Application.get_env(:tesla, Deletion)
    key = {"https://assets.groupher.com/internal", ["assets:object:delete"]}
    tokens = :ets.lookup(:groupher_service_token_cache, key)
    System.put_env("ASSETS_HUB_DELETE_ENDPOINT", "http://127.0.0.1:#{:ranch.get_port(ref)}")
    Application.put_env(:tesla, Deletion, adapter: {SendBarrier, parent: self()})

    :ets.insert(
      :groupher_service_token_cache,
      {key, "test-service-token", System.system_time(:second) + 3600}
    )

    try do
      action.()
    after
      Plug.Cowboy.shutdown(ref)

      if endpoint do
        System.put_env("ASSETS_HUB_DELETE_ENDPOINT", endpoint)
      else
        System.delete_env("ASSETS_HUB_DELETE_ENDPOINT")
      end

      if adapter do
        Application.put_env(:tesla, Deletion, adapter)
      else
        Application.delete_env(:tesla, Deletion)
      end

      :ets.delete(:groupher_service_token_cache, key)
      Enum.each(tokens, &:ets.insert(:groupher_service_token_cache, &1))
    end
  end

  defp stop_task(%Task{pid: pid}) do
    if Process.alive?(pid) do
      Process.exit(pid, :kill)
    end
  end
end
