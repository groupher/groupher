# Run only with a locally built release; never against a deployed machine.
# This harness hardcodes a loopback test DB and rolls back every domain write.
if System.get_env("ALLOW_LOCAL_SEED_SMOKE") != "true", do: raise("local smoke opt-in required")
Application.load(:groupher_server)
Application.put_env(:groupher_server, :env, :test)
Application.put_env(:groupher_server, :dns_cluster_query, nil)

Application.put_env(:groupher_server, GroupherServer.Repo,
  hostname: "127.0.0.1",
  port: 5432,
  database: "groupher_server_test",
  username: "postgres",
  password: "postgres",
  ssl: false,
  pool: DBConnection.ConnectionPool,
  pool_size: 5
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:groupher_server)

{:ok, _} =
  Oban.start_link(repo: GroupherServer.Repo, testing: :manual, queues: false, plugins: false)

System.put_env("PRODUCTION_SEED_ENABLED", "true")
alias GroupherServer.Repo
alias GroupherServer.CMS.ProductionSeed
alias ProductionSeed.{CLI, Cleanup}
[["groupher_server_test"]] = Repo.query!("SELECT current_database()").rows
before = Repo.aggregate(ProductionSeed.Run, :count)
artifact = System.fetch_env!("PRODUCTION_SEED_SMOKE_ARTIFACT")

{:error, :local_smoke_rollback} =
  Repo.transaction(
    fn ->
      request = %{
        "command" => "bootstrap",
        "runId" => "local-release-smoke",
        "database" => "groupher_server_test"
      }

      {:ok, _} = request |> Jason.encode!() |> Base.encode64() |> CLI.run_base64()

      {:ok, _} =
        CLI.execute(Map.merge(request, %{"command" => "seed", "artifactPath" => artifact}))

      {:ok, _} = CLI.execute(Map.put(request, "command", "close"))
      {:ok, plan} = Cleanup.report("local-release-smoke", "groupher_server_test", "purge")

      {:ok, _} =
        Cleanup.apply(
          "local-release-smoke",
          "groupher_server_test",
          "purge",
          plan.report_digest
        )

      {:error, %{reason: :seed_cleanup_incomplete}} =
        Cleanup.verify("local-release-smoke", "groupher_server_test", "purge")

      Repo.rollback(:local_smoke_rollback)
    end,
    timeout: 120_000
  )

^before = Repo.aggregate(ProductionSeed.Run, :count)

IO.puts(
  "production seed prod-release smoke: PASS (all writes rolled back; cleanup verify rejects pending effects)"
)
