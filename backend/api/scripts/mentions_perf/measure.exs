defmodule MentionsPerf.Measure do
  @moduledoc """
  Measures complete domain reads and explains their actual captured SELECTs.

      domain callback -> Repo telemetry -> latency/SQL/queue -> full EXPLAIN ANALYZE
  """
  alias GroupherServer.Repo

  def request(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}

    :ok =
      :telemetry.attach(
        handler,
        [:groupher_server, :repo, :query],
        fn _, times, meta, {pid, reference} ->
          if self() == pid, do: send(pid, {reference, times, meta})
        end,
        {self(), ref}
      )

    try do
      {elapsed, result} = :timer.tc(fun)
      statements = drain(ref, [])

      outcome =
        case result do
          {:ok, _} -> "ok"
          {:error, %{reason: reason}} -> to_string(reason)
          {:error, reason} -> inspect(reason)
        end

      {%{
         elapsed_ms: elapsed / 1000,
         outcome: outcome,
         sql_count: length(statements),
         queue_ms: sum_time(statements, :queue_time),
         query_ms: sum_time(statements, :query_time)
       }, result, statements}
    after
      :telemetry.detach(handler)
    end
  end

  def summary(samples) do
    successful = Enum.filter(samples, &(&1.outcome == "ok"))

    %{
      requests: length(samples),
      outcomes: Enum.frequencies_by(samples, & &1.outcome),
      successful_requests: length(successful),
      success_ratio: if(samples == [], do: nil, else: length(successful) / length(samples)),
      successful_latency_ms: percentiles(Enum.map(successful, & &1.elapsed_ms)),
      latency_ms: percentiles(Enum.map(samples, & &1.elapsed_ms)),
      pool_queue_ms: percentiles(Enum.map(samples, & &1.queue_ms)),
      sql_query_ms: percentiles(Enum.map(samples, & &1.query_ms)),
      max_sql_count: Enum.max(Enum.map(samples, & &1.sql_count), fn -> 0 end),
      max_server_request_sql_count:
        Enum.max(
          Enum.map(samples, &Map.get(&1, :max_server_request_sql_count, &1.sql_count)),
          fn -> 0 end
        ),
      max_server_request_elapsed_ms:
        Enum.max(
          Enum.map(samples, &Map.get(&1, :max_server_request_elapsed_ms, &1.elapsed_ms)),
          fn -> 0 end
        ),
      server_requests: Enum.sum(Enum.map(samples, &Map.get(&1, :attempts, 1))),
      restarted_interactions: Enum.count(samples, &(Map.get(&1, :attempts, 1) > 1))
    }
  end

  @doc "Measures one caller interaction with at most two independent first-page HTTP requests."
  def interaction(read) do
    started = System.monotonic_time(:microsecond)
    {first, result, statements} = request(read)

    case result do
      {:error, %{reason: :mentions_graph_invalid_request}} ->
        {second, result, next_statements} = request(read)

        sample = %{
          second
          | elapsed_ms: (System.monotonic_time(:microsecond) - started) / 1000,
            sql_count: first.sql_count + second.sql_count,
            query_ms: first.query_ms + second.query_ms,
            queue_ms: first.queue_ms + second.queue_ms
        }

        sample =
          Map.merge(sample, %{
            attempts: 2,
            max_server_request_sql_count: max(first.sql_count, second.sql_count),
            max_server_request_elapsed_ms: max(first.elapsed_ms, second.elapsed_ms)
          })

        {sample, result, statements ++ next_statements}

      _ ->
        sample =
          Map.merge(first, %{
            attempts: 1,
            max_server_request_sql_count: first.sql_count,
            max_server_request_elapsed_ms: first.elapsed_ms
          })

        {sample, result, statements}
    end
  end

  def percentiles([]), do: %{p50: 0, p95: 0, p99: 0, max: 0}

  def percentiles(values) do
    sorted = Enum.sort(values)

    Map.new([{:p50, 0.5}, {:p95, 0.95}, {:p99, 0.99}, {:max, 1}], fn {key, p} ->
      {key, Float.round(Enum.at(sorted, max(ceil(length(sorted) * p) - 1, 0)) * 1.0, 3)}
    end)
  end

  def plans(statements) do
    statements
    |> Enum.filter(&String.starts_with?(String.trim_leading(&1.sql), ["SELECT", "WITH"]))
    |> Enum.reject(&String.contains?(&1.sql, "set_config"))
    |> Enum.map(fn statement ->
      {:ok, %{rows: [[raw]]}} =
        Ecto.Adapters.SQL.query(
          Repo,
          "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " <> statement.sql,
          statement.params,
          timeout: 10_000
        )

      [plan] = raw
      nodes = flatten(plan["Plan"])
      scans = Enum.filter(nodes, &String.contains?(&1["Node Type"], "Scan"))
      work = Enum.map(scans, &scan_work/1)

      %{
        fingerprint: Base.encode16(:crypto.hash(:sha256, statement.sql), case: :lower),
        sql: statement.sql,
        params_external_term_base64: Base.encode64(:erlang.term_to_binary(statement.params)),
        plan: plan,
        metrics: %{
          execution_ms: plan["Execution Time"],
          planning_ms: plan["Planning Time"],
          max_scan_work: Enum.max(work, fn -> 0 end),
          summed_scan_work: Enum.sum(work),
          max_join_work:
            nodes
            |> Enum.map(fn node ->
              ((node["Actual Rows"] || 0) + (node["Rows Removed by Join Filter"] || 0)) *
                (node["Actual Loops"] || 0)
            end)
            |> Enum.max(fn -> 0 end),
          shared_hit_blocks: plan["Plan"]["Shared Hit Blocks"],
          shared_read_blocks: plan["Plan"]["Shared Read Blocks"],
          temp_written_blocks: plan["Plan"]["Temp Written Blocks"],
          scans:
            Enum.map(scans, fn node ->
              %{
                relation: node["Relation Name"],
                kind: node["Node Type"],
                index: node["Index Name"],
                work: scan_work(node)
              }
            end)
        }
      }
    end)
  end

  defp scan_work(node) do
    ((node["Actual Rows"] || 0) + (node["Rows Removed by Filter"] || 0) +
       (node["Rows Removed by Index Recheck"] || 0)) * (node["Actual Loops"] || 0)
  end

  defp flatten(node), do: [node | Enum.flat_map(node["Plans"] || [], &flatten/1)]

  defp sum_time(statements, key) do
    Enum.reduce(
      statements,
      0,
      &(&2 + System.convert_time_unit(Map.get(&1.times, key, 0), :native, :microsecond))
    ) / 1000
  end

  defp drain(ref, acc) do
    receive do
      {^ref, times, meta} ->
        if String.downcase(String.trim(meta.query)) in ["begin", "commit", "rollback"] do
          drain(ref, acc)
        else
          drain(ref, [%{sql: meta.query, params: meta.params, times: times} | acc])
        end
    after
      0 -> Enum.reverse(acc)
    end
  end
end

defmodule MentionsPerf.Locks do
  @moduledoc """
  Probes real global revision contention through independent committed connections.

      lock holder + waiting writer -> pg_blocking_pids -> reader fence + wait evidence
  """
  alias GroupherServer.Repo
  alias CMS.ArtimentMentions.MentionsGraphRevision, as: Revision
  alias MentionsPerf.Measure

  def controlled(read) do
    parent = self()

    holder =
      Task.async(fn ->
        Repo.transaction(fn ->
          [[pid]] = query("SELECT pg_backend_pid()")
          {:ok, :pass} = Revision.bump()
          send(parent, {:holder, pid})

          receive do
            :release -> :released
          after
            5_000 -> raise "Lock control release timed out"
          end
        end)
      end)

    holder_pid =
      receive do
        {:holder, pid} -> pid
      after
        5_000 -> raise "Lock holder did not start"
      end

    waiter =
      Task.async(fn ->
        Repo.transaction(fn ->
          [[pid]] = query("SELECT pg_backend_pid()")
          send(parent, {:waiter, pid})
          {us, {:ok, :pass}} = :timer.tc(fn -> Revision.bump() end)
          us / 1000
        end)
      end)

    waiter_pid =
      receive do
        {:waiter, pid} -> pid
      after
        5_000 -> raise "Waiting writer did not start"
      end

    try do
      observed =
        Enum.reduce_while(1..100, [], fn _, _ ->
          rows = blocked()

          if Enum.any?(rows, fn [pid, _, _, blockers] ->
               pid == waiter_pid and holder_pid in blockers
             end) do
            {:halt, rows}
          else
            Process.sleep(10)
            {:cont, []}
          end
        end)

      {sample, _, _} = Measure.request(read)
      send(holder.pid, :release)
      {:ok, _} = Task.await(holder, 10_000)
      {:ok, wait_ms} = Task.await(waiter, 10_000)

      %{
        blocking_observed: observed != [],
        blocked_samples: observed,
        waiting_update_elapsed_ms: wait_ms,
        reader_while_locked: sample
      }
    after
      send(holder.pid, :release)
    end
  end

  def load(read, writers, hold_ms, writer_interval_ms \\ 0, read_mode \\ :single) do
    parent = self()

    duration =
      case System.get_env("CMS_MENTIONS_PERF_LOAD_DURATION_MS") do
        nil -> nil
        value -> String.to_integer(value)
      end

    unless is_nil(duration) or duration in 1000..300_000 do
      raise("Load duration must be 1s to 5min")
    end

    limit = if duration, do: 100_000, else: 20

    tasks =
      for role <- List.duplicate(:reader, 4) ++ List.duplicate(:writer, writers) do
        Task.async(fn ->
          receive do
            {:start, deadline} ->
              Stream.iterate(0, &(&1 + 1))
              |> Stream.take_while(fn index ->
                index < limit and
                  (is_nil(deadline) or System.monotonic_time(:millisecond) < deadline)
              end)
              |> Enum.each(fn _ ->
                callback =
                  if role == :reader,
                    do: read,
                    else: fn ->
                      Repo.transaction(fn ->
                        {:ok, :pass} = Revision.bump()
                        if hold_ms > 0, do: Process.sleep(hold_ms)
                      end)
                    end

                sample_started = System.monotonic_time(:microsecond)

                {sample, _, _} =
                  if role == :reader and read_mode == :restart_once do
                    Measure.interaction(callback)
                  else
                    Measure.request(callback)
                  end

                sample =
                  Map.merge(sample, %{
                    started_us: sample_started,
                    finished_us: System.monotonic_time(:microsecond)
                  })

                send(parent, {:load_sample, role, sample})

                if role == :writer and writer_interval_ms > 0 do
                  Process.sleep(writer_interval_ms)
                end
              end)
          end
        end)
      end

    started = System.monotonic_time(:millisecond)
    deadline = if duration, do: started + duration
    Enum.each(tasks, &send(&1.pid, {:start, deadline}))
    observations = observe(tasks, [])
    Enum.each(tasks, &Task.await(&1, 60_000))
    samples = drain_load([])

    elapsed_ms = System.monotonic_time(:millisecond) - started
    reader_summary = Measure.summary(for {:reader, row} <- samples, do: row)
    readers = for {:reader, row} <- samples, do: row
    first_read = Enum.min(Enum.map(readers, & &1.started_us))
    last_read = Enum.max(Enum.map(readers, & &1.finished_us))
    read_window_ms = (last_read - first_read) / 1000

    overlapping_writes =
      Enum.count(samples, fn
        {:writer, row} -> row.finished_us >= first_read and row.finished_us <= last_read
        _ -> false
      end)

    %{
      readers:
        Map.merge(reader_summary, %{
          active_window_ms: read_window_ms,
          successful_requests_per_active_second:
            reader_summary.successful_requests * 1000 / max(read_window_ms, 1),
          completed_writes_in_read_window: overlapping_writes,
          completed_writes_per_read_window_second:
            overlapping_writes * 1000 / max(read_window_ms, 1)
        }),
      writers: Measure.summary(for {:writer, row} <- samples, do: row),
      elapsed_ms: elapsed_ms,
      observer_interval_ms: 20,
      observed_lock_wait_samples: Enum.count(observations, &(&1 != [])),
      max_blocked_connections: observations |> Enum.map(&length/1) |> Enum.max(fn -> 0 end),
      hold_after_revision_bump_ms: hold_ms,
      writer_interval_ms: writer_interval_ms,
      requested_duration_ms: duration,
      reader_unit: read_mode
    }
  end

  defp observe(tasks, acc) do
    if Enum.any?(tasks, &Process.alive?(&1.pid)) do
      rows = blocked()
      Process.sleep(20)
      observe(tasks, [rows | acc])
    else
      acc
    end
  end

  defp blocked do
    query("""
    SELECT pid, wait_event_type, wait_event, pg_blocking_pids(pid)
    FROM pg_stat_activity WHERE datname = current_database()
      AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
    """)
  end

  defp query(sql), do: Ecto.Adapters.SQL.query!(Repo, sql, [], timeout: 5_000).rows

  defp drain_load(acc) do
    receive do
      {:load_sample, role, sample} -> drain_load([{role, sample} | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end
end
