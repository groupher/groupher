for file <- [
      "seed/run.ex",
      "seed/target.ex",
      "local_test_actors/communities.ex",
      "local_test_actors/grants.ex",
      "seed/article/create.ex",
      "seed/cleanup/run.ex",
      "seed/actor/create.ex",
      "seed/admin/invite.ex",
      "seed/admin/accept.ex",
      "seed/admin/membership.ex",
      "seed/admin/set_permissions.ex",
      "seed/admin/remove.ex",
      "seed/community/create.ex",
      "seed/community/request_destroy.ex",
      "seed/home/prepare.ex",
      "seed/scenario/theme_permissions.ex",
      "local_test_actors.ex"
    ] do
  Code.require_file("../../dev/" <> file, __DIR__)
end

defmodule GroupherServer.LocalSeedConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{Repo, Seed}
  alias Seed.Actor.Create
  alias Seed.Article.Create, as: CreateArticle
  alias Seed.Cleanup.Run, as: Cleanup
  alias Seed.Community.Create, as: CreateCommunity
  alias Helper.ORM.AdvisoryLock

  @moduletag timeout: 60_000
  @moduletag skip: System.get_env("TEST_SEED_CONCURRENCY") != "1"

  setup do
    Sandbox.unboxed_run(Repo, fn ->
      %{rows: [[database]]} = Repo.query!("SELECT current_database()")

      unless database == "groupher_seed_concurrency" do
        raise "seed concurrency tests require the disposable groupher_seed_concurrency database"
      end
    end)

    :ok
  end

  test "a creation holding the run lock enters the cleanup snapshot" do
    run = run_name()
    parent = self()

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")
    end)

    writer =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transact_result(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            {:ok, result} = Create.run(run, %{"alias" => "editor"})
            send(parent, {:writer_locked, self(), backend_pid()})
            await_release()
            {:ok, result}
          end)
        end)
      end)

    assert_receive {:writer_locked, writer_pid, writer_db}, 10_000

    cleanup =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:cleanup_started, backend_pid()})
            Cleanup.apply(run)
          end)
        end)
      end)

    assert_receive {:cleanup_started, cleanup_db}, 10_000
    assert_waiting_on(cleanup_db, writer_db)
    send(writer_pid, :release)
    assert {:ok, %{alias: "editor"}} = Task.await(writer, 15_000)
    assert {:ok, %{status: "cleaned"}} = Task.await(cleanup, 15_000)

    Sandbox.unboxed_run(Repo, fn ->
      bindings = GroupherServer.Seed.Run.bindings(run)
      assert Enum.sort(Enum.map(bindings, & &1.raw["alias"])) == ["editor", "owner"]
      assert Enum.all?(bindings, &(&1.raw["status"] == "closed"))
    end)
  end

  test "cleanup preview neither waits for a run writer nor seals the run" do
    run = run_name()
    parent = self()

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")
    end)

    writer =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transact_result(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            {:ok, result} = Create.run(run, %{"alias" => "editor"})
            send(parent, {:preview_writer_locked, self()})
            await_release()
            {:ok, result}
          end)
        end)
      end)

    assert_receive {:preview_writer_locked, writer_pid}, 10_000

    preview =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn -> Cleanup.report(run) end)
      end)

    assert {:ok, %{status: "report", accounts_retained: accounts}} = Task.await(preview, 5_000)
    assert Enum.map(accounts, & &1.alias) == ["owner"]
    send(writer_pid, :release)
    assert {:ok, %{alias: "editor"}} = Task.await(writer, 15_000)

    Sandbox.unboxed_run(Repo, fn ->
      bindings = GroupherServer.Seed.Run.bindings(run)
      assert Enum.sort(Enum.map(bindings, & &1.raw["alias"])) == ["editor", "owner"]
      assert Enum.all?(bindings, &(&1.raw["status"] == "active"))
    end)
  end

  test "a creation queued after cleanup observes the closed run" do
    run = run_name()
    parent = self()

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")
    end)

    blocker =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transaction(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            send(parent, {:blocker_locked, self(), backend_pid()})
            await_release()
          end)
        end)
      end)

    assert_receive {:blocker_locked, blocker_pid, blocker_db}, 10_000

    cleanup =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:cleanup_started, backend_pid()})
            Cleanup.apply(run)
          end)
        end)
      end)

    assert_receive {:cleanup_started, cleanup_db}, 10_000
    assert_waiting_on(cleanup_db, blocker_db)

    writer =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:writer_started, backend_pid()})
            create_actor(run, "new-alias")
          end)
        end)
      end)

    assert_receive {:writer_started, writer_db}, 10_000
    assert_waiting_on(writer_db, blocker_db)
    send(blocker_pid, :release)
    assert {:ok, :released} = Task.await(blocker, 15_000)
    assert {:ok, %{status: "cleaned"}} = Task.await(cleanup, 15_000)
    assert {:error, :local_test_run_closed} = Task.await(writer, 15_000)

    Sandbox.unboxed_run(Repo, fn ->
      assert Enum.map(GroupherServer.Seed.Run.bindings(run), & &1.raw["alias"]) == ["owner"]
    end)
  end

  test "concurrent community creation in one run returns the same reference" do
    run = run_name()
    slug = run_name()
    parent = self()
    input = %{"owner" => "owner", "slug" => slug}

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")
    end)

    first =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transact_result(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            {:ok, result} = CreateCommunity.run(run, input)
            send(parent, {:community_created, self(), backend_pid()})
            await_release()
            {:ok, result}
          end)
        end)
      end)

    assert_receive {:community_created, first_pid, first_db}, 15_000

    second =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:community_retry, backend_pid()})
            create_community(run, input)
          end)
        end)
      end)

    assert_receive {:community_retry, second_db}, 10_000
    assert_waiting_on(second_db, first_db)
    send(first_pid, :release)
    assert {:ok, original} = Task.await(first, 20_000)
    assert {:ok, repeated} = Task.await(second, 20_000)
    assert original.communityRef == repeated.communityRef

    Sandbox.unboxed_run(Repo, fn ->
      assert [_community] =
               Repo.all(from(c in GroupherServer.CMS.Model.Community, where: c.slug == ^slug))

      [binding] = GroupherServer.Seed.Run.bindings(run)
      assert length(binding.raw["communities"]) == 1
    end)
  end

  test "different runs competing for a slug leave ownership with one run" do
    first_run = run_name()
    second_run = run_name()
    slug = run_name()
    parent = self()
    input = %{"owner" => "owner", "slug" => slug}

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(first_run, "owner")
      assert {:ok, _} = create_actor(second_run, "owner")
    end)

    first =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transact_result(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{first_run}")
            {:ok, result} = CreateCommunity.run(first_run, input)
            send(parent, {:slug_reserved, self(), backend_pid()})
            await_release()
            {:ok, result}
          end)
        end)
      end)

    assert_receive {:slug_reserved, first_pid, first_db}, 15_000

    second =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:slug_competitor, backend_pid()})
            create_community(second_run, input)
          end)
        end)
      end)

    assert_receive {:slug_competitor, second_db}, 10_000
    assert_waiting_on(second_db, first_db)
    send(first_pid, :release)
    assert {:ok, winner} = Task.await(first, 20_000)
    assert {:error, :local_test_community_collision} = Task.await(second, 20_000)

    Sandbox.unboxed_run(Repo, fn ->
      community = Repo.get_by!(GroupherServer.CMS.Model.Community, slug: slug)
      assert community.ref == winner.communityRef
      [first_binding] = GroupherServer.Seed.Run.bindings(first_run)
      [second_binding] = GroupherServer.Seed.Run.bindings(second_run)
      assert first_binding.raw["communities"] == [community.id]
      assert second_binding.raw["communities"] == []
    end)
  end

  test "community creation rolled back before commit can be retried without an orphan" do
    run = run_name()
    slug = run_name()
    input = %{"owner" => "owner", "slug" => slug}

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")

      assert {:error, :simulated_failure} =
               Repo.transact_result(fn ->
                 {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
                 assert {:ok, _} = CreateCommunity.run(run, input)
                 {:error, :simulated_failure}
               end)

      assert is_nil(Repo.get_by(GroupherServer.CMS.Model.Community, slug: slug))
      [binding] = GroupherServer.Seed.Run.bindings(run)
      assert binding.raw["communities"] == []

      assert {:ok, created} = create_community(run, input)
      assert {:ok, repeated} = create_community(run, input)
      assert repeated.communityRef == created.communityRef

      community = Repo.get_by!(GroupherServer.CMS.Model.Community, slug: slug)
      assert community.ref == created.communityRef
      [binding] = GroupherServer.Seed.Run.bindings(run)
      assert binding.raw["communities"] == [community.id]

      assert binding.raw["community_lords"][Integer.to_string(community.id)] ==
               created.admin.memberId
    end)
  end

  test "empty cleanup fails and a different run stays open after cleanup" do
    first_run = run_name()
    second_run = run_name()

    Sandbox.unboxed_run(Repo, fn ->
      assert {:error, :local_test_run_not_found} = Cleanup.apply(first_run)
      assert {:ok, _} = create_actor(first_run, "owner")
      assert {:ok, _} = create_actor(second_run, "owner")
      assert {:ok, %{status: "cleaned"}} = Cleanup.apply(first_run)

      assert {:ok, _, first_binding} =
               GroupherServer.Seed.Run.actor(second_run, "owner")

      assert first_binding.raw["status"] == "active"
      assert {:ok, %{alias: "editor"}} = create_actor(second_run, "editor")
      [closed] = GroupherServer.Seed.Run.bindings(first_run)
      assert closed.raw["status"] == "closed"
    end)
  end

  test "only one concurrent browser may begin the same article dispatch" do
    run = run_name()
    slug = run_name()
    parent = self()
    input = %{"alias" => "owner", "community" => slug, "thread" => "post"}

    prepared =
      Sandbox.unboxed_run(Repo, fn ->
        assert {:ok, _} = create_actor(run, "owner")
        assert {:ok, _} = create_community(run, %{"owner" => "owner", "slug" => slug})

        assert {:ok, result} =
                 Repo.transact_result(fn ->
                   {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
                   CreateArticle.prepare(run, input)
                 end)

        result
      end)

    begin_input =
      input
      |> Map.put("commandId", prepared.command.commandId)
      |> Map.put("attemptId", Ecto.UUID.generate())

    first =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transact_result(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            {:ok, result} = CreateArticle.begin_dispatch(run, begin_input)
            send(parent, {:dispatch_claimed, self(), backend_pid()})
            await_release()
            {:ok, result}
          end)
        end)
      end)

    assert_receive {:dispatch_claimed, first_pid, first_db}, 10_000

    cleanup =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:dispatch_cleanup_waiter, backend_pid()})
            Cleanup.apply(run)
          end)
        end)
      end)

    assert_receive {:dispatch_cleanup_waiter, cleanup_db}, 10_000
    assert_waiting_on(cleanup_db, first_db)

    second =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:dispatch_competitor, backend_pid()})

            Repo.transact_result(fn ->
              {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")

              CreateArticle.begin_dispatch(
                run,
                Map.put(begin_input, "attemptId", Ecto.UUID.generate())
              )
            end)
          end)
        end)
      end)

    assert_receive {:dispatch_competitor, second_db}, 10_000
    assert_waiting_on(second_db, first_db)
    send(first_pid, :release)
    assert {:ok, %{status: "dispatched"}} = Task.await(first, 15_000)
    assert {:ok, %{status: "blocked", blockers: blockers}} = Task.await(cleanup, 15_000)
    assert "article_fixture_pending" in blockers
    assert {:error, :local_test_article_recovery_required} = Task.await(second, 15_000)
  end

  test "cleanup cancels an unsent article and prevents a late begin" do
    run = run_name()
    slug = run_name()
    input = %{"alias" => "owner", "community" => slug, "thread" => "post"}

    Sandbox.unboxed_run(Repo, fn ->
      assert {:ok, _} = create_actor(run, "owner")
      assert {:ok, _} = create_community(run, %{"owner" => "owner", "slug" => slug})

      assert {:ok, prepared} =
               Repo.transact_result(fn ->
                 {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
                 CreateArticle.prepare(run, input)
               end)

      assert {:ok, %{status: "cleaned"}} = Cleanup.apply(run)
      [binding] = GroupherServer.Seed.Run.bindings(run)
      assert binding.raw["status"] == "closed"
      assert [entry] = Map.values(binding.raw["articles"])
      assert entry["status"] == "cancelled"
      assert entry["commandId"] == prepared.command.commandId

      assert {:error, :local_test_actor_unavailable} =
               Repo.transact_result(fn ->
                 {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")

                 CreateArticle.begin_dispatch(
                   run,
                   input
                   |> Map.put("commandId", prepared.command.commandId)
                   |> Map.put("attemptId", Ecto.UUID.generate())
                 )
               end)

      assert {:ok, %{status: "cleaned"}} = Cleanup.apply(run)
    end)
  end

  test "cleanup queued before an article begin cancels it atomically" do
    run = run_name()
    slug = run_name()
    parent = self()
    input = %{"alias" => "owner", "community" => slug, "thread" => "post"}

    prepared =
      Sandbox.unboxed_run(Repo, fn ->
        assert {:ok, _} = create_actor(run, "owner")
        assert {:ok, _} = create_community(run, %{"owner" => "owner", "slug" => slug})

        assert {:ok, result} =
                 Repo.transact_result(fn ->
                   {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
                   CreateArticle.prepare(run, input)
                 end)

        result
      end)

    blocker =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transaction(fn ->
            {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
            send(parent, {:article_blocker_locked, self(), backend_pid()})
            await_release()
          end)
        end)
      end)

    assert_receive {:article_blocker_locked, blocker_pid, blocker_db}, 10_000

    cleanup =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:article_cleanup_waiter, backend_pid()})
            Cleanup.apply(run)
          end)
        end)
      end)

    assert_receive {:article_cleanup_waiter, cleanup_db}, 10_000
    assert_waiting_on(cleanup_db, blocker_db)

    begin =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.checkout(fn ->
            send(parent, {:article_begin_waiter, backend_pid()})

            Repo.transact_result(fn ->
              {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")

              CreateArticle.begin_dispatch(
                run,
                input
                |> Map.put("commandId", prepared.command.commandId)
                |> Map.put("attemptId", Ecto.UUID.generate())
              )
            end)
          end)
        end)
      end)

    assert_receive {:article_begin_waiter, begin_db}, 10_000
    assert_waiting_on(begin_db, blocker_db)
    send(blocker_pid, :release)
    assert {:ok, :released} = Task.await(blocker, 15_000)
    assert {:ok, %{status: "cleaned"}} = Task.await(cleanup, 15_000)
    assert {:error, :local_test_actor_unavailable} = Task.await(begin, 15_000)

    Sandbox.unboxed_run(Repo, fn ->
      [binding] = GroupherServer.Seed.Run.bindings(run)
      assert [entry] = Map.values(binding.raw["articles"])
      assert entry["status"] == "cancelled"
    end)
  end

  defp create_actor(run, name) do
    Repo.transact_result(fn ->
      with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}") do
        Create.run(run, %{"alias" => name})
      end
    end)
  end

  defp create_community(run, input) do
    Repo.transact_result(fn ->
      with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}") do
        CreateCommunity.run(run, input)
      end
    end)
  end

  defp backend_pid do
    %{rows: [[pid]]} = Repo.query!("SELECT pg_backend_pid()")
    pid
  end

  defp assert_waiting_on(waiter, blocker) do
    assert :waiting ==
             Sandbox.unboxed_run(Repo, fn -> wait_for_blocker(waiter, blocker, 200) end)
  end

  defp wait_for_blocker(_, _, 0), do: :timeout

  defp wait_for_blocker(waiter, blocker, attempts) do
    %{rows: [[blocked]]} =
      Repo.query!("SELECT $2::integer = ANY(pg_blocking_pids($1::integer))", [waiter, blocker])

    if blocked do
      :waiting
    else
      Process.sleep(25)
      wait_for_blocker(waiter, blocker, attempts - 1)
    end
  end

  defp await_release do
    receive do
      :release -> :released
    after
      15_000 -> Repo.rollback(:coordination_timeout)
    end
  end

  defp run_name do
    "seed-race-#{System.unique_integer([:positive])}"
  end
end
