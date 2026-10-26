defmodule Mix.Tasks.ReviewBot.V2.Preflight do
  @moduledoc """
  Reports the read-only V2 moderation cutover preflight for the configured database.

      mix review_bot.v2.preflight
        -> schema applicability + old restrictions/pending + hidden projections
        -> counts and blocker targets (no writes)
  """

  use Mix.Task

  alias GroupherServer.Repo

  @shortdoc "Reports the read-only ReviewBot V2 cutover preflight"

  @tables ~w(article_review_restrictions comment_review_restrictions doc_review_restrictions)
  @projection_tables ~w(article_publics article_bindings doc_publics)
  @v2_storage_migration 20_261_023_136_000

  @impl true
  def run(_args) do
    Mix.Task.run("app.start")

    migration = latest_migration()
    columns = projection_columns(migration)
    restrictions = restriction_counts(migration)
    hidden = hidden_counts(columns)
    pending = pending_count(migration)
    inconsistencies = fact_inconsistency_count(columns, migration, hidden)

    report = %{
      checked_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      repo: Repo.config()[:database],
      latest_migration: migration,
      projection_columns: columns,
      active_restrictions_by_table: restrictions.active,
      restricted_targets_by_table: restrictions.targets,
      cutover_blockers: %{
        pending_targets: pending.targets,
        fact_inconsistency_targets: inconsistencies.targets,
        unexplained_hidden_targets: hidden.targets
      },
      active_restriction_count: Enum.sum(Map.values(restrictions.active)),
      restricted_target_count: Enum.sum(Map.values(restrictions.targets)),
      pending_target_count: pending.count,
      pending_targets: pending.targets,
      hidden_projection_count: hidden.total,
      hidden_projection_by_table: hidden.by_table,
      unexplained_hidden_projection_count: hidden.unexplained,
      unexplained_hidden_targets: hidden.targets,
      fact_inconsistency_count: inconsistencies.count,
      fact_inconsistency_targets: inconsistencies.targets
    }

    Mix.shell().info(Jason.encode!(report, pretty: true))

    blockers =
      report.active_restriction_count + report.restricted_target_count +
        report.pending_target_count + report.unexplained_hidden_projection_count +
        report.fact_inconsistency_count

    if blockers > 0 or Enum.any?(columns, fn {_table, value} -> value == :unknown end) do
      Mix.raise("ReviewBot V2 cutover preflight has blockers; no data was changed")
    end
  end

  defp projection_columns(migration) do
    Map.new(@projection_tables, fn table ->
      exists? = table_exists?(table)

      value =
        cond do
          not exists? ->
            :unknown

          migration_at_least?(migration, @v2_storage_migration) ->
            :not_applicable_v2_storage

          column_exists?(table, "visible") ->
            :present

          table in ["article_publics", "article_bindings"] and
              migration_at_least?(migration, 20_261_023_120_000) ->
            :not_applicable_column_removed

          table in ["article_publics", "article_bindings"] ->
            :unknown

          table == "doc_publics" ->
            :unknown
        end

      {table, value}
    end)
  end

  defp migration_at_least?(migration, required) when is_binary(migration) do
    case Integer.parse(migration) do
      {version, ""} -> version >= required
      _ -> false
    end
  end

  defp migration_at_least?(_migration, _required), do: false

  defp restriction_counts(migration) do
    if migration_at_least?(migration, @v2_storage_migration) do
      %{active: Map.new(@tables, &{&1, 0}), targets: Map.new(@tables, &{&1, 0})}
    else
      restriction_counts_before_v2()
    end
  end

  defp restriction_counts_before_v2 do
    Enum.reduce(@tables, %{active: %{}, targets: %{}}, fn table, acc ->
      active = scalar!("SELECT count(*) FROM cms.#{table} WHERE ended_at IS NULL")

      target_expression =
        if table == "doc_review_restrictions",
          do: "(lifecycle.article_id, lifecycle.branch_id)",
          else: "restriction.lifecycle_id"

      lifecycle_table = String.replace_prefix(table, "_review_restrictions", "_lifecycles")

      targets =
        scalar!("""
        SELECT count(*) FROM (
          SELECT DISTINCT #{target_expression}
          FROM cms.#{table} AS restriction
          JOIN cms.#{lifecycle_table} AS lifecycle ON lifecycle.id = restriction.lifecycle_id
          WHERE restriction.ended_at IS NULL
        ) AS active_targets
        """)

      %{active: Map.put(acc.active, table, active), targets: Map.put(acc.targets, table, targets)}
    end)
  end

  defp pending_count(migration) do
    if migration_at_least?(migration, @v2_storage_migration) do
      %{count: 0, targets: []}
    else
      pending_count_before_v2()
    end
  end

  defp pending_count_before_v2 do
    restriction_targets =
      Enum.map(@tables, fn table ->
        lifecycle_table = String.replace_prefix(table, "_review_restrictions", "_lifecycles")

        """
        SELECT lifecycle.id::text || ':' || restriction.scope_key AS identity,
               restriction.lifecycle_id::text AS target
        FROM cms.#{table} AS restriction
        JOIN cms.#{lifecycle_table} AS lifecycle ON lifecycle.id = restriction.lifecycle_id
        WHERE restriction.ended_at IS NULL AND restriction.kind IN ('awaiting_ai', 'awaiting_human')
        """
      end)

    case_targets = """
      SELECT case_record.target_key || ':' || case_record.scope_key AS identity,
             case_record.target_key AS target
      FROM alert_board.cases AS case_record
      WHERE case_record.status = 'open'
        AND (case_record.target_key LIKE 'article:%' OR case_record.target_key LIKE 'comment:%'
          OR case_record.target_key LIKE 'doc:%')
        AND NOT EXISTS (
          SELECT 1 FROM alert_board.reports AS report
          WHERE report.case_id = case_record.id AND report.withdrawn_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM alert_board.decisions AS decision
          WHERE decision.case_id = case_record.id
        )
    """

    targets =
      (restriction_targets ++ [case_targets])
      |> Enum.map_join("\nUNION\n", &String.trim/1)
      |> then(fn sql -> "SELECT DISTINCT identity, target FROM (#{sql}) AS all_pending" end)
      |> query_rows!()
      |> Enum.map(fn [identity, target] -> %{identity: identity, target: target} end)

    %{count: length(targets), targets: targets}
  end

  defp hidden_counts(columns) do
    tables = Enum.filter(@projection_tables, &(Map.get(columns, &1) == :present))

    by_table =
      Map.new(tables, fn table ->
        [count, unexplained] = query_rows!(hidden_query(table)) |> hd()
        targets = query_rows!(unexplained_hidden_targets_query(table)) |> Enum.map(&hd/1)
        {table, %{count: count, unexplained: unexplained, targets: targets}}
      end)

    %{
      total: Enum.sum(Enum.map(Map.values(by_table), & &1.count)),
      by_table: by_table,
      unexplained: Enum.sum(Enum.map(Map.values(by_table), & &1.unexplained)),
      targets:
        Enum.flat_map(by_table, fn {table, value} ->
          Enum.map(value.targets, &%{table: table, target: &1})
        end)
    }
  end

  defp hidden_query("article_publics") do
    """
    SELECT count(*)::bigint,
           count(*) FILTER (WHERE lifecycle.id IS NULL OR community.id IS NULL OR
             (lifecycle.state IN ('published', 'archived')
             AND NOT EXISTS (
               SELECT 1 FROM cms.article_review_restrictions restriction
               WHERE restriction.lifecycle_id = lifecycle.id
                 AND restriction.scope_key = 'platform' AND restriction.ended_at IS NULL
             )))::bigint
    FROM cms.article_publics public
    LEFT JOIN cms.article_lifecycles lifecycle ON lifecycle.article_id = public.article_id
    WHERE public.visible = false
    """
  end

  defp hidden_query("article_bindings") do
    """
    SELECT count(*)::bigint,
           count(*) FILTER (WHERE lifecycle.id IS NULL OR
             (lifecycle.state IN ('published', 'archived')
             AND ((community_lifecycle.id IS NOT NULL
                   AND community_lifecycle.state IN ('active', 'read_only'))
               OR (community_lifecycle.id IS NULL AND community.pending = 0))
             AND NOT EXISTS (
               SELECT 1 FROM cms.article_review_restrictions restriction
               WHERE restriction.lifecycle_id = lifecycle.id
                 AND restriction.scope_key IN ('platform', 'community:' || binding.community_id::text)
                 AND restriction.ended_at IS NULL
             )))::bigint
    FROM cms.article_bindings binding
    LEFT JOIN cms.article_lifecycles lifecycle ON lifecycle.article_id = binding.article_id
    LEFT JOIN cms.communities community ON community.id = binding.community_id
    LEFT JOIN cms.community_lifecycles community_lifecycle
      ON community_lifecycle.community_id = binding.community_id
    WHERE binding.visible = false
    """
  end

  defp hidden_query("doc_publics") do
    """
    SELECT count(*)::bigint,
           count(*) FILTER (WHERE lifecycle.id IS NULL OR
             (lifecycle.state IN ('published', 'archived')
             AND NOT EXISTS (
               SELECT 1 FROM cms.doc_review_restrictions restriction
               WHERE restriction.lifecycle_id = lifecycle.id AND restriction.ended_at IS NULL
             )))::bigint
    FROM cms.doc_publics public
    LEFT JOIN cms.doc_lifecycles lifecycle
      ON lifecycle.article_id = public.article_id AND lifecycle.branch_id = public.branch_id
    WHERE public.visible = false
    """
  end

  defp fact_inconsistency_count(columns, migration, hidden) do
    orphan_targets =
      if migration_at_least?(migration, @v2_storage_migration) do
        []
      else
        Enum.flat_map(@tables, fn table -> orphan_restriction_targets(table) end)
      end

    hidden_counts =
      Enum.filter(@projection_tables, &(Map.get(columns, &1) == :present))
      |> Enum.map(fn table -> query_rows!(hidden_query(table)) |> hd() |> Enum.at(1) end)

    targets =
      Enum.map(orphan_targets, &%{type: "orphaned_review_block", target: &1}) ++
        Enum.map(hidden.targets, &%{type: "unexplained_hidden_projection", target: &1})

    %{count: length(orphan_targets) + Enum.sum(hidden_counts), targets: targets}
  end

  defp orphan_restriction_targets(table) do
    lifecycle_table = String.replace_prefix(table, "_review_restrictions", "_lifecycles")

    query_rows!("""
    SELECT restriction.id::text || ':' || restriction.lifecycle_id::text
    FROM cms.#{table} restriction
    LEFT JOIN cms.#{lifecycle_table} lifecycle ON lifecycle.id = restriction.lifecycle_id
    WHERE lifecycle.id IS NULL AND restriction.ended_at IS NULL
    """)
    |> Enum.map(&hd/1)
  end

  defp unexplained_hidden_targets_query("article_publics") do
    """
    SELECT public.article_id::text
    FROM cms.article_publics public
    LEFT JOIN cms.article_lifecycles lifecycle ON lifecycle.article_id = public.article_id
    WHERE public.visible = false AND (lifecycle.id IS NULL OR
      (lifecycle.state IN ('published', 'archived') AND NOT EXISTS (
        SELECT 1 FROM cms.article_review_restrictions restriction
        WHERE restriction.lifecycle_id = lifecycle.id
          AND restriction.scope_key = 'platform' AND restriction.ended_at IS NULL
      )))
    """
  end

  defp unexplained_hidden_targets_query("article_bindings") do
    """
    SELECT binding.article_id::text || '@' || binding.community_id::text
    FROM cms.article_bindings binding
    LEFT JOIN cms.article_lifecycles lifecycle ON lifecycle.article_id = binding.article_id
    LEFT JOIN cms.communities community ON community.id = binding.community_id
    LEFT JOIN cms.community_lifecycles community_lifecycle
      ON community_lifecycle.community_id = binding.community_id
    WHERE binding.visible = false AND (lifecycle.id IS NULL OR community.id IS NULL OR
      (lifecycle.state IN ('published', 'archived')
       AND ((community_lifecycle.id IS NOT NULL
             AND community_lifecycle.state IN ('active', 'read_only'))
         OR (community_lifecycle.id IS NULL AND community.pending = 0))
       AND NOT EXISTS (
         SELECT 1 FROM cms.article_review_restrictions restriction
         WHERE restriction.lifecycle_id = lifecycle.id
           AND restriction.scope_key IN ('platform', 'community:' || binding.community_id::text)
           AND restriction.ended_at IS NULL
       )))
    """
  end

  defp unexplained_hidden_targets_query("doc_publics") do
    """
    SELECT public.article_id::text || '@' || public.branch_id::text
    FROM cms.doc_publics public
    LEFT JOIN cms.doc_lifecycles lifecycle
      ON lifecycle.article_id = public.article_id AND lifecycle.branch_id = public.branch_id
    WHERE public.visible = false AND (lifecycle.id IS NULL OR
      (lifecycle.state IN ('published', 'archived') AND NOT EXISTS (
        SELECT 1 FROM cms.doc_review_restrictions restriction
        WHERE restriction.lifecycle_id = lifecycle.id AND restriction.ended_at IS NULL
      )))
    """
  end

  defp table_exists?(table) do
    scalar!("""
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'cms' AND table_name = '#{table}'
    """) == 1
  end

  defp column_exists?(table, column) do
    scalar!("""
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'cms' AND table_name = '#{table}' AND column_name = '#{column}'
    """) == 1
  end

  defp latest_migration do
    case query_rows!("SELECT max(version)::text FROM public.schema_migrations") do
      [[version]] -> version
      _ -> nil
    end
  end

  defp scalar!(sql) do
    case query_rows!(sql) do
      [[value]] -> value
      _ -> 0
    end
  end

  defp query_rows!(sql) do
    case Repo.query(sql) do
      {:ok, result} -> result.rows
      {:error, reason} -> Mix.raise("preflight query failed: #{Exception.message(reason)}")
    end
  end
end
