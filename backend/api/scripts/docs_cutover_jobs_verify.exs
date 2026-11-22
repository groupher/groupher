# Exercise the read-only inventory only in a caller-selected disposable test database.
alias GroupherServer.Repo

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("MIGRATION_EXPECTED_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Docs job inventory exercise requires an explicitly named disposable test database"
end

fixture_id = Ecto.UUID.generate()
event_id = Ecto.UUID.generate()
queue = "b0_inventory_#{fixture_id}"

try do
  Repo.query!(
    """
    INSERT INTO cms.outbox_events
      (id,event,resource_type,resource_id,command_id,available_at,locked_at,locked_by,inserted_at,updated_at)
    VALUES ($1,'doc_tree.changed','community','b0-fixture',$2,now(),now(),'b0-fixture',now(),now())
    """,
    [Ecto.UUID.dump!(event_id), fixture_id]
  )

  jobs = [
    {"GroupherServer.Jobs.CMSOutboxArticle", %{"event_id" => Ecto.UUID.generate()}},
    {"GroupherServer.Jobs.CMSArtimentReview", %{}},
    {"GroupherServer.Jobs.CMSOutboxSearch", %{"event_id" => event_id}},
    {"Example.Unrelated", %{}},
    {"GroupherServer.Jobs.SnapshotRefresh",
     %{
       "type" => "article",
       "version" => 1,
       "refs" => %{"thread" => "doc", "ids" => []},
       "opts" => %{}
     }},
    {"GroupherServer.Jobs.SnapshotRefresh",
     %{
       "type" => "article",
       "version" => 1,
       "refs" => %{"thread" => "post", "ids" => []},
       "opts" => %{}
     }},
    {"GroupherServer.Jobs.SnapshotRefresh",
     %{"type" => "comment", "version" => 1, "refs" => %{"ids" => []}, "opts" => %{}}},
    {"GroupherServer.Jobs.SnapshotRefresh",
     %{"type" => "user", "version" => 1, "refs" => [], "opts" => %{}}}
  ]

  Enum.each(jobs, fn {worker, args} ->
    Repo.query!("INSERT INTO public.oban_jobs(worker,queue,args) VALUES ($1,$2,$3)", [
      worker,
      queue,
      args
    ])
  end)

  {output, 0} =
    System.cmd("mix", ["run", "scripts/docs_cutover_root_report.exs"],
      env: [
        {"MIX_ENV", "test"},
        {"TEST_DB_NAME", database},
        {"MIGRATION_EXPECTED_DATABASE", database}
      ],
      stderr_to_stdout: true
    )

  prefix = "DOCS_CUTOVER_ROOT_REPORT="

  json =
    output
    |> String.split("\n")
    |> Enum.find_value(fn line ->
      String.starts_with?(line, prefix) && String.replace_prefix(line, prefix, "")
    end)

  report = Jason.decode!(json)

  orphans =
    Enum.filter(
      report["unattributed_outbox_jobs_by_worker_queue_and_state"],
      &(&1["queue"] == queue)
    )

  orphan_workers = MapSet.new(orphans, & &1["worker"])

  expected_orphans =
    MapSet.new(["GroupherServer.Jobs.CMSOutboxArticle", "GroupherServer.Jobs.CMSArtimentReview"])

  true = orphan_workers == expected_orphans
  true = report["unattributed_outbox_jobs_require_review"]
  true = report["unclassified_snapshot_refresh_jobs_require_review"]
  true = report["ownership_anomalies_require_stop"]

  refresh =
    Enum.filter(
      report["snapshot_refresh_jobs_by_queue_state_type_version_and_thread"],
      &(&1["queue"] == queue)
    )

  refresh_types = MapSet.new(refresh, &{&1["type"], &1["thread"]})

  true =
    refresh_types ==
      MapSet.new([{"article", "doc"}, {"article", "post"}, {"comment", nil}, {"user", nil}])

  true =
    Enum.any?(
      report["doc_outbox_locks_by_resource_event_and_status"],
      &(&1["event"] == "doc_tree.changed" and &1["count"] >= 1)
    )

  true =
    Enum.any?(
      report["all_jobs_by_worker_queue_and_state"],
      &(&1["queue"] == queue and &1["worker"] == "Example.Unrelated")
    )

  IO.puts("Docs job inventory fixture passed")
after
  Repo.query!("DELETE FROM public.oban_jobs WHERE queue=$1", [queue])
  Repo.query!("DELETE FROM cms.outbox_events WHERE id=$1", [Ecto.UUID.dump!(event_id)])
end
