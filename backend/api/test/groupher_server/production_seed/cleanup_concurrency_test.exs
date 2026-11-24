defmodule GroupherServer.CMS.ProductionSeed.CleanupConcurrencyTest do
  use ExUnit.Case, async: false
  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.GlobalPassport
  alias CMS.ProductionSeed

  @tag skip: System.get_env("TEST_SEED_ISOLATED") != "1"
  @tag timeout: 60_000
  test "cleanup rechecks a concurrent Global grant before revoking seed roles" do
    Sandbox.unboxed_run(Repo, fn ->
      previous = System.get_env("PRODUCTION_SEED_ENABLED")
      System.put_env("PRODUCTION_SEED_ENABLED", "true")
      db = Repo.config()[:database]
      parent = self()

      try do
        {:ok, manifest} = ProductionSeed.bootstrap("seed-race", db)
        {:ok, report} = ProductionSeed.Cleanup.report("seed-race", db, "retain")
        user_id = manifest["users"]["platform"]
        original = Repo.get_by!(GlobalPassport, user_id: user_id)

        writer =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                {:ok, updated} =
                  CMS.Passport.Store.grant_global_in_transaction(user_id, original, %{
                    "community.create" => true
                  })

                send(parent, {:grant_locked, self()})

                receive do
                  :commit -> updated
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:grant_locked, writer_pid}, 10_000

        cleanup =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :cleanup_started)
              ProductionSeed.Cleanup.apply("seed-race", db, "retain", report.report_digest)
            end)
          end)

        assert_receive :cleanup_started, 10_000
        assert Task.yield(cleanup, 100) == nil
        send(writer_pid, :commit)
        assert {:ok, updated} = Task.await(writer, 10_000)
        assert {:error, :seed_stale_cleanup_report} = Task.await(cleanup, 10_000)
        current = Repo.get!(GlobalPassport, updated.id)
        assert current.revision == updated.revision
        assert current.permissions["community.create"] == true
        assert Repo.get_by!(ProductionSeed.Run, run_id: "seed-race").status == "active"
      after
        if previous do
          System.put_env("PRODUCTION_SEED_ENABLED", previous)
        else
          System.delete_env("PRODUCTION_SEED_ENABLED")
        end
      end
    end)
  end
end
