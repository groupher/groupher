# Local capacity runner. New dedicated DB only; no migrations or writes on any target.
# Dataset -> full domain reads -> EXPLAIN -> independent lock contenders -> evidence.
unless Mix.env() == :test do
  raise "Only MIX_ENV=test is supported"
end

alias GroupherServer.{CMS, Repo}
config = Application.fetch_env!(:groupher_server, Repo)
name = System.fetch_env!("TEST_DB_NAME")

unless String.starts_with?(name, "groupher_mentions_perf_") and
         config[:database] == name and config[:hostname] in ["localhost", "127.0.0.1"] do
  raise "Requires an explicit owned groupher_mentions_perf_* database on localhost"
end

Application.put_env(
  :groupher_server,
  Repo,
  config |> Keyword.put(:pool, DBConnection.ConnectionPool) |> Keyword.put(:pool_size, 20)
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:groupher_server)
Code.require_file("dataset.exs", __DIR__)
Code.require_file("measure.exs", __DIR__)
Code.require_file("http.exs", __DIR__)
alias MentionsPerf.{Dataset, Measure, Locks}
alias GroupherServer.Pagi.Params

output = System.fetch_env!("CMS_MENTIONS_PERF_OUTPUT")
File.mkdir_p!(output)
per_type = System.get_env("CMS_MENTIONS_PERF_PER_TYPE", "24") |> String.to_integer()
samples = System.get_env("CMS_MENTIONS_PERF_SAMPLES", "100") |> String.to_integer()
unless per_type in 4..128 and samples in 3..1000, do: raise("Workload size outside bounded range")
IO.puts("Building #{per_type} resources per Article type, canonical Comments and User Tickets")
profile_path = System.get_env("CMS_MENTIONS_PERF_PROFILE")
profile = if profile_path, do: profile_path |> File.read!() |> Jason.decode!()
catalog = if System.get_env("CMS_MENTIONS_PERF_CATALOG") == "1", do: profile

if System.get_env("CMS_MENTIONS_PERF_CATALOG") == "1" and is_nil(catalog) do
  raise("Catalog mode requires a target aggregate profile")
end

dataset =
  if path = System.get_env("CMS_MENTIONS_PERF_REUSE") do
    fixture = path |> File.read!() |> Jason.decode!(keys: :atoms!)
    if fixture.database != name, do: raise("Fixture belongs to a different database")
    decode = fn locator -> Map.update!(locator, :type, &String.to_existing_atom/1) end

    fixture.dataset
    |> Map.update!(:focus, decode)
    |> Map.update!(:doc, decode)
    |> Map.update!(:comment, decode)
  else
    Dataset.build(per_type, catalog)
  end

File.write!(
  Path.join(output, "fixture.json"),
  Jason.encode!(
    %{
      database: name,
      dataset: Map.take(dataset, [:community, :focus, :doc, :comment, :summary])
    },
    pretty: true
  )
)

if Repo.aggregate(CMS.Model.Mentions.Edge, :count) != dataset.summary.current_edges do
  raise("Fixture edge count changed; do not accept an altered workload")
end

IO.puts("Dataset: " <> Jason.encode!(dataset.summary))
{_, bindings} = Code.eval_file("profile.exs", __DIR__)
local_profile = Keyword.fetch!(bindings, :profile)
File.write!(Path.join(output, "dataset-profile.json"), Jason.encode!(local_profile, pretty: true))
community = dataset.community
focus = dataset.focus
first = fn -> CMS.mentions_graph_page(community, focus, nil, 20) end
{:ok, first_page} = first.()
unless first_page.has_next_page, do: raise("Hub fixture has no second page")
cursor = first_page.end_cursor
root = %{type: focus.type, locator: focus}
comment_root = %{type: :comment, locator: dataset.comment}
{:ok, outgoing} = CMS.mentions(community, root, %Params.Cursor{first: 20})

http_query = """
query PerfGraph($community: String!, $focus: MentionsGraphLocatorInput!, $after: String) {
  mentionsGraph(community: $community, focus: $focus, after: $after, first: 20) {
    nodes { id type status title url canOpen locator { type articleInnerId commentInnerId } }
    edges { id from to occurrencesCount }
    hasNextPage endCursor
  }
}
"""

http = fn after_cursor ->
  to_input = fn locator -> Map.update!(locator, :type, &(to_string(&1) |> String.upcase())) end

  MentionsPerf.HTTP.graph(
    http_query,
    %{
      community: community,
      focus: to_input.(focus),
      after: after_cursor
    }
  )
end

spec_bytes = File.read!(Path.join(__DIR__, "acceptance.json"))
spec = Jason.decode!(spec_bytes)
p95 = spec["proposed_p95_ms"]

cases = [
  {"http_graph_first", fn -> http.(nil) end, p95["graph_first"]},
  {"http_graph_cursor", fn -> http.(cursor) end, p95["graph_first"]},
  {"graph_hub_first", first, p95["graph_first"]},
  {"graph_hub_cursor", fn -> CMS.mentions_graph_page(community, focus, cursor, 20) end,
   p95["graph_first"]},
  {"outgoing_cursor", fn -> CMS.mentions(community, root, %Params.Cursor{first: 20}) end,
   p95["one_hop"]},
  {"outgoing_cursor_second",
   fn ->
     CMS.mentions(community, root, %Params.Cursor{
       first: 20,
       after: outgoing.page_info.end_cursor
     })
   end, p95["one_hop"]},
  {"incoming_cursor", fn -> CMS.mentioned_by(community, root, %Params.Cursor{first: 20}) end,
   p95["one_hop"]},
  {"outgoing_offset_count",
   fn ->
     CMS.mentions(community, root, %Params.Offset{page: 1, size: 20})
   end, p95["one_hop"]},
  {"outgoing_deep_offset_count",
   fn ->
     CMS.mentions(community, root, %Params.Offset{page: 10, size: 20})
   end, p95["one_hop"]},
  {"comment_outgoing",
   fn ->
     CMS.mentions(community, comment_root, %Params.Cursor{first: 20})
   end, p95["one_hop"]},
  {"doc_comment_seeds",
   fn -> CMS.mentions_graph_article_comments(community, dataset.doc, nil, 20) end,
   p95["comment_seeds"]},
  {"revision", fn -> CMS.mentions_graph_revision(community, focus) end, p95["revision"]}
]

load_only = System.get_env("CMS_MENTIONS_PERF_LOAD_ONLY") == "1"
cases = if load_only, do: [], else: cases

{results, plans} =
  Enum.reduce(cases, {%{}, %{}}, fn {label, callback, p95_limit}, {results, plans} ->
    {cold, {:ok, _}, sql} = Measure.request(callback)
    explained = Measure.plans(sql)
    for _ <- 1..3, do: callback.()
    rows = for _ <- 1..samples, do: elem(Measure.request(callback), 0)
    summary = Measure.summary(rows)

    sequential_edge_scans =
      for plan <- explained,
          scan <- plan.metrics.scans,
          scan.relation == "mention_current_edges",
          do: scan.work

    # Counts and deep OFFSET are inherently degree-dependent; record, don't pretend O(first).
    bounded_window = not String.contains?(label, "offset")

    scan_pass =
      not bounded_window or
        Enum.all?(
          sequential_edge_scans,
          &(&1 <= spec["scan_review"]["bounded_window_max_edge_scan_work_per_node"])
        )

    pass =
      summary.outcomes == %{"ok" => samples} and
        summary.latency_ms.p95 <= p95_limit and scan_pass

    row =
      Map.merge(summary, %{
        first_observed_request: cold,
        proposed_p95_limit_ms: p95_limit,
        bounded_window_scan_gate: scan_pass,
        passed: pass
      })

    IO.puts(label <> ": " <> Jason.encode!(Map.take(row, [:latency_ms, :max_sql_count, :passed])))

    File.write!(
      Path.join(output, "full-plans.json.gz"),
      :zlib.gzip(Jason.encode!(Map.put(plans, label, explained)))
    )

    {Map.put(results, label, row), Map.put(plans, label, explained)}
  end)

controlled = Locks.controlled(first)

load_jobs = %{
  read_only: fn -> Locks.load(first, 0, 0) end,
  revision_writers: fn -> Locks.load(first, 2, 0) end,
  revision_writers_held: fn -> Locks.load(first, 2, 10) end,
  revision_writers_paced: fn -> Locks.load(first, 2, 0, 500) end,
  http_paced_single: fn -> Locks.load(fn -> http.([%{node: focus}]) end, 2, 0, 500) end,
  http_paced_restart_once: fn ->
    Locks.load(fn -> http.([%{node: focus}]) end, 2, 0, 500, :restart_once)
  end
}

load_order = [
  :read_only,
  :revision_writers,
  :revision_writers_held,
  :revision_writers_paced,
  :http_paced_single,
  :http_paced_restart_once
]

selected_load_phases =
  case System.get_env("CMS_MENTIONS_PERF_LOAD_PHASES") do
    nil ->
      load_order

    names when load_only ->
      by_name = Map.new(Map.keys(load_jobs), &{Atom.to_string(&1), &1})
      selected = names |> String.split(",", trim: true) |> Enum.map(&Map.fetch!(by_name, &1))

      if selected == [] or Enum.uniq(selected) != selected do
        raise("Invalid load phase selection")
      end

      selected

    _ ->
      raise("Partial load phases require CMS_MENTIONS_PERF_LOAD_ONLY=1")
  end

load = Map.new(selected_load_phases, fn phase -> {phase, load_jobs[phase].()} end)

lock_pass =
  controlled.blocking_observed and controlled.waiting_update_elapsed_ms > 0 and
    controlled.reader_while_locked.outcome == "ok" and
    Enum.all?(Map.values(load), fn phase ->
      Enum.all?(
        Map.keys(phase.readers.outcomes),
        &(&1 in ["ok", "mentions_graph_invalid_request"])
      ) and
        phase.writers.latency_ms.p95 <= p95["writer_transaction"]
    end)

[[version]] = Ecto.Adapters.SQL.query!(Repo, "SELECT version()", []).rows
{_, query_beam, _} = :code.get_object_code(CMS.ArtimentMentions.MentionsGraph.Query)

result = %{
  captured_at: DateTime.utc_now(),
  acceptance_sha256: Base.encode16(:crypto.hash(:sha256, spec_bytes), case: :lower),
  dataset: dataset.summary,
  environment: %{
    database: name,
    postgres: version,
    query_beam_sha256: Base.encode16(:crypto.hash(:sha256, query_beam), case: :lower),
    pool_size: 20,
    schedulers: System.schedulers_online(),
    elixir: System.version(),
    otp: System.otp_release()
  },
  methodology: %{
    domain_requests: true,
    http_handler_included_cases: ["http_graph_first", "http_graph_six_types"],
    http_network_included: false,
    warm_samples_per_case: samples,
    warmup_requests: 3,
    first_measured_request_is_not_cold_storage: true,
    max_scan_work:
      "max((actual rows + removed by filter + recheck) * loops), not total unique rows",
    summed_scan_work: "sum of scan-node work, not unique physical rows",
    proposed_thresholds: true
  },
  reads: results,
  plan_summaries:
    Map.new(plans, fn {label, statements} ->
      {label,
       Enum.map(
         statements,
         &%{fingerprint: &1.fingerprint, metrics: Map.drop(&1.metrics, [:scans])}
       )}
    end),
  controlled_lock: controlled,
  load: load,
  selected_load_phases: selected_load_phases,
  lock_checks_passed: lock_pass,
  local_checks_passed:
    not load_only and Enum.all?(Map.values(results), & &1.passed) and lock_pass,
  load_only: load_only,
  target_profile: profile,
  b2_performance_exit:
    "NOT_ACCEPTED: controlled envelope; target-calibrated graph and matching hardware/load evidence still required"
}

File.write!(Path.join(output, "summary.json"), Jason.encode!(result, pretty: true))
File.write!(Path.join(output, "full-plans.json.gz"), :zlib.gzip(Jason.encode!(plans)))

IO.puts(
  "Evidence: #{output}; local checks passed: #{result.local_checks_passed}; B2 total exit remains pending"
)

if not result.local_checks_passed, do: System.halt(2)
