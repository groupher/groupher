# Aggregate-only probe, runnable through the serving release RPC or a local Repo.
# Repo -> repeatable-read READ ONLY transaction -> counts/settings -> JSON, no IDs/body.
repo = GroupherServer.Repo
collect_body_census = Keyword.get(binding(), :mentions_perf_body_census, false)
query = fn sql -> Ecto.Adapters.SQL.query!(repo, sql, [], timeout: 5_000).rows end

{:ok, profile} =
  repo.transaction(
    fn ->
      query.("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
      query.("SET LOCAL statement_timeout = '5s'")

      exists = fn name ->
        [[value]] = query.("SELECT to_regclass('#{name}') IS NOT NULL")
        value
      end

      tables =
        Map.new(
          ~w(cms.articles cms.comments cms.mention_endpoints cms.mention_current_edges cms.mentions_graph_state),
          fn name ->
            count =
              if exists.(name) do
                [[count]] = query.("SELECT count(*) FROM #{name}")
                count
              end

            {name, count}
          end
        )

      degrees =
        if exists.("cms.mention_current_edges") do
          Map.new(
            [{"outgoing", "source_endpoint_id"}, {"incoming", "target_endpoint_id"}],
            fn {label, column} ->
              [row] =
                query.("""
                SELECT count(*), coalesce(max(n),0),
                       coalesce(percentile_disc(0.50) WITHIN GROUP (ORDER BY n),0),
                       coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY n),0),
                       coalesce(percentile_disc(0.99) WITHIN GROUP (ORDER BY n),0)
                FROM (SELECT #{column}, count(*) n FROM cms.mention_current_edges
                      WHERE #{column} IS NOT NULL GROUP BY #{column}) d
                """)

              {label, Enum.zip(~w(nonzero_sources max p50 p95 p99), row) |> Map.new()}
            end
          )
        end

      settings =
        query.("""
        SELECT name, setting, unit FROM pg_settings
        WHERE name IN ('server_version','shared_buffers','work_mem','effective_cache_size',
                       'random_page_cost','max_connections','default_statistics_target','plan_cache_mode')
        ORDER BY name
        """)

      # Optional census runs entirely in the target process. Only cardinalities leave it.
      candidate_profile =
        if collect_body_census do
          bodies =
            query.("""
            SELECT a.thread::text, b.json FROM cms.article_publics p
              JOIN cms.articles a ON a.id=p.article_id
              JOIN cms.article_revisions r ON r.id=p.revision_id
              JOIN cms.article_body_snapshots b ON b.id=r.body_snapshot_id
              WHERE octet_length(b.json) <= 8388608
            UNION ALL
            SELECT 'doc-main', b.json FROM cms.doc_publics p
              JOIN cms.doc_branches d ON d.id=p.branch_id AND d.type='main'
              JOIN cms.doc_branch_versions v ON v.id=p.branch_version_id
              JOIN cms.article_revisions r ON r.id=v.revision_id
              JOIN cms.article_body_snapshots b ON b.id=r.body_snapshot_id
              WHERE octet_length(b.json) <= 8388608
            UNION ALL
            SELECT 'comment-' || c.thread, b.json FROM cms.comment_bodies b
              JOIN cms.comments c ON c.id=b.comment_id
              WHERE octet_length(b.json) <= 8388608
            LIMIT 10000
            """)

          walk = fn recur, value ->
            cond do
              is_list(value) ->
                Enum.flat_map(value, &recur.(recur, &1))

              is_map(value) ->
                own =
                  case {Map.get(value, "type"), Map.get(value, "key")} do
                    {"mention", key} when is_binary(key) -> [{"mention", key}]
                    {kind, _} when kind in ["a", "link"] -> [{"link", ""}]
                    _ -> []
                  end

                own ++ Enum.flat_map(Map.values(value), &recur.(recur, &1))

              true ->
                []
            end
          end

          rows =
            Enum.map(bodies, fn [kind, body] ->
              case Jason.decode(body) do
                {:ok, ast} ->
                  candidates = walk.(walk, ast)

                  internal =
                    candidates
                    |> Enum.filter(fn {kind, key} ->
                      kind == "mention" and
                        hd(String.split(key, ":", parts: 2)) in ~w(post blog changelog doc ticket comment)
                    end)
                    |> Enum.uniq()

                  %{
                    kind: kind,
                    bytes: byte_size(body),
                    internal_keys: length(internal),
                    mentions: Enum.count(candidates, &(elem(&1, 0) == "mention")),
                    links: Enum.count(candidates, &(elem(&1, 0) == "link")),
                    invalid_json: 0
                  }

                _ ->
                  %{
                    kind: kind,
                    bytes: byte_size(body),
                    internal_keys: 0,
                    mentions: 0,
                    links: 0,
                    invalid_json: 1
                  }
              end
            end)

          quantiles = fn values ->
            sorted = Enum.sort(values)

            Map.new([{"p50", 0.5}, {"p95", 0.95}, {"p99", 0.99}, {"max", 1.0}], fn {key, p} ->
              {key, Enum.at(sorted, max(ceil(length(sorted) * p) - 1, 0), 0)}
            end)
          end

          %{
            selected_bodies: length(rows),
            limit_reached: length(rows) == 10000,
            maximum_body_bytes: 8_388_608,
            anonymous_scope_verified: false,
            scope:
              "selected Article/Doc main bodies and current Comments; no draft/historical export",
            candidate_counts_are_resolved_edges: false,
            recognized_inline_formats_only: true,
            by_type:
              rows
              |> Enum.group_by(& &1.kind)
              |> Map.new(fn {kind, group} ->
                {kind,
                 %{
                   bodies: length(group),
                   invalid_json: Enum.sum(Enum.map(group, & &1.invalid_json)),
                   bytes: quantiles.(Enum.map(group, & &1.bytes)),
                   distinct_internal_mention_keys:
                     quantiles.(Enum.map(group, & &1.internal_keys)),
                   mention_nodes: quantiles.(Enum.map(group, & &1.mentions)),
                   link_nodes: quantiles.(Enum.map(group, & &1.links))
                 }}
              end)
          }
        end

      %{
        captured_at: DateTime.utc_now(),
        provenance:
          "aggregate-only serving database; optional in-process current-body census; no body export or graph initialization",
        transaction_read_only: true,
        tables: tables,
        article_types:
          query.("SELECT thread, count(*) FROM cms.articles GROUP BY thread ORDER BY thread"),
        comment_types:
          query.("SELECT thread, count(*) FROM cms.comments GROUP BY thread ORDER BY thread"),
        degree_distribution: degrees,
        settings: settings,
        selected_body_syntax_profile: candidate_profile,
        new_graph_data_available:
          is_integer(tables["cms.mention_current_edges"]) and
            tables["cms.mention_current_edges"] > 0
      }
    end,
    timeout: 15_000
  )

IO.puts("MENTIONS_PERF_PROFILE=" <> Jason.encode!(profile))
