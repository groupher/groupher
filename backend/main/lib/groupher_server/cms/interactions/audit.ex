defmodule GroupherServer.CMS.Interactions.Audit do
  @moduledoc """
  Periodically verifies bitmap projections against their authoritative fact rows.

  The normal mutation path never depends on this module. It is a repair-only
  safety net: it first counts drift, then rebuilds the affected bitmap from the
  fact table in the same transaction. Its CTE queries are intentionally kept
  here, rather than in interaction request code: each audit must aggregate a
  fact table and repair its matching per-thread projection atomically.

  Business position:

      InteractionAudit job -> Interactions.Audit -> fact table + bitmap repair
  """

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Interactions.Registry

  @article_threads ~w(post blog changelog doc)

  @doc "Verifies bitmap/count projections against fact tables and repairs drift atomically."
  @spec verify_and_repair() :: {:ok, %{repairs: non_neg_integer()}} | {:error, term()}
  def verify_and_repair do
    Repo.transaction(fn ->
      repairs =
        Enum.reduce(@article_threads, 0, fn thread, total ->
          total +
            repair_fixed(thread, Registry.fact(:upvote).table, "upvoted_user_ids") +
            repair_fixed(thread, Registry.fact(:collect).table, "collected_user_ids") +
            repair_emotions(thread, Registry.fact(:emotion).table) +
            repair_reports(thread)
        end) +
          repair_fixed("comment", Registry.fact(:comment_upvote).table, "upvoted_user_ids") +
          repair_emotions("comment", Registry.fact(:comment_emotion).table) +
          repair_reports("comment")

      %{repairs: repairs}
    end)
    |> case do
      {:ok, result} ->
        :telemetry.execute([:groupher, :cms, :interactions, :audit], result, %{})
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp repair_fixed(thread, fact_table, bitmap_column) do
    target_column = target_column(thread)
    info_table = Registry.target(String.to_existing_atom(thread)).reaction.__schema__(:source)
    fact_filter = if thread == "comment", do: "WHERE TRUE", else: "WHERE thread = '#{thread}'"
    count_column = fixed_count_column(bitmap_column)

    insert_missing_infos(info_table, target_column, fact_table, target_column, fact_filter)

    repair_count =
      count_fixed_drift(
        info_table,
        target_column,
        fact_table,
        target_column,
        fact_filter,
        bitmap_column,
        count_column
      )

    if repair_count > 0 do
      rebuild_fixed(
        info_table,
        target_column,
        fact_table,
        target_column,
        fact_filter,
        bitmap_column,
        count_column
      )
    end

    repair_count
  end

  defp repair_emotions(thread, fact_table) do
    target_column = target_column(thread)
    info_table = Registry.target(String.to_existing_atom(thread)).emotion.__schema__(:source)
    fact_filter = "WHERE #{target_column} IS NOT NULL"

    insert_missing_emotion_infos(info_table, target_column, fact_table, fact_filter)

    repair_count = count_emotion_drift(info_table, target_column, fact_table, fact_filter)

    if repair_count > 0 do
      rebuild_emotions(info_table, target_column, fact_table, fact_filter)
    end

    repair_count
  end

  defp repair_reports(thread) do
    target_column = target_column(thread)
    info_table = Registry.target(String.to_existing_atom(thread)).reaction.__schema__(:source)
    report_filter = "WHERE #{target_column} IS NOT NULL"

    insert_missing_report_infos(info_table, target_column, report_filter)
    repair_count = count_report_drift(info_table, target_column, report_filter)

    if repair_count > 0 do
      rebuild_reports(info_table, target_column, report_filter)
    end

    repair_count
  end

  defp insert_missing_infos(info_table, info_target, fact_table, fact_target, filter) do
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      INSERT INTO cms.#{info_table} (#{info_target}, inserted_at, updated_at)
      SELECT DISTINCT #{fact_target}, $1::timestamptz, $1::timestamptz
      FROM cms.#{fact_table}
      #{filter}
      ON CONFLICT (#{info_target}) DO NOTHING
      """,
      [now]
    )
  end

  defp count_fixed_drift(
         info_table,
         info_target,
         fact_table,
         fact_target,
         filter,
         bitmap_column,
         count_column
       ) do
    count_drift =
      if is_nil(count_column),
        do: "FALSE",
        else: "OR info.#{count_column} IS DISTINCT FROM COALESCE(rb64_cardinality(fact.users), 0)"

    count!("""
    WITH fact AS (
      SELECT #{fact_target} AS target_id, rb64_build(array_agg(user_id)::bigint[]) AS users
      FROM cms.#{fact_table}
      #{filter}
      GROUP BY #{fact_target}
    )
    SELECT count(*)
    FROM cms.#{info_table} info
    LEFT JOIN fact ON fact.target_id = info.#{info_target}
    WHERE info.#{bitmap_column} IS DISTINCT FROM COALESCE(fact.users, '{}'::roaringbitmap64)
    #{count_drift}
    """)
  end

  defp rebuild_fixed(
         info_table,
         info_target,
         fact_table,
         fact_target,
         filter,
         bitmap_column,
         count_column
       ) do
    now = DateTime.utc_now(:second)

    count_from_fact =
      if is_nil(count_column), do: "", else: ", #{count_column} = rb64_cardinality(fact.users)"

    empty_count = if is_nil(count_column), do: "", else: ", #{count_column} = 0"

    Repo.query!(
      """
      WITH fact AS (
        SELECT #{fact_target} AS target_id, rb64_build(array_agg(user_id)::bigint[]) AS users
        FROM cms.#{fact_table}
        #{filter}
        GROUP BY #{fact_target}
      )
      UPDATE cms.#{info_table} info
      SET #{bitmap_column} = COALESCE(fact.users, '{}'::roaringbitmap64)#{count_from_fact},
          updated_at = $1::timestamptz
      FROM fact
      WHERE info.#{info_target} = fact.target_id
      """,
      [now]
    )

    Repo.query!(
      """
      UPDATE cms.#{info_table} info
      SET #{bitmap_column} = '{}'::roaringbitmap64#{empty_count}, updated_at = $1::timestamptz
      WHERE NOT EXISTS (
        SELECT 1
        FROM cms.#{fact_table} fact
        #{filter}
        AND fact.#{fact_target} = info.#{info_target}
      )
      """,
      [now]
    )
  end

  defp insert_missing_emotion_infos(info_table, target_column, fact_table, filter) do
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      INSERT INTO cms.#{info_table} (#{target_column}, emotion, inserted_at, updated_at)
      SELECT DISTINCT #{target_column}, emotion, $1::timestamptz, $1::timestamptz
      FROM cms.#{fact_table}
      #{filter}
      ON CONFLICT (#{target_column}, emotion) DO NOTHING
      """,
      [now]
    )
  end

  defp count_emotion_drift(info_table, target_column, fact_table, filter) do
    count!("""
    WITH fact AS (
      SELECT #{target_column} AS target_id, emotion, rb64_build(array_agg(user_id)::bigint[]) AS users
      FROM cms.#{fact_table}
      #{filter}
      GROUP BY #{target_column}, emotion
    )
    SELECT count(*)
    FROM cms.#{info_table} info
    LEFT JOIN fact ON fact.target_id = info.#{target_column} AND fact.emotion = info.emotion
    WHERE info.user_ids IS DISTINCT FROM COALESCE(fact.users, '{}'::roaringbitmap64)
       OR info.users_count IS DISTINCT FROM COALESCE(rb64_cardinality(fact.users), 0)
    """)
  end

  defp rebuild_emotions(info_table, target_column, fact_table, filter) do
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      WITH fact AS (
        SELECT #{target_column} AS target_id, emotion, rb64_build(array_agg(user_id)::bigint[]) AS users
        FROM cms.#{fact_table}
        #{filter}
        GROUP BY #{target_column}, emotion
      )
      UPDATE cms.#{info_table} info
      SET user_ids = fact.users, users_count = rb64_cardinality(fact.users), updated_at = $1::timestamptz
      FROM fact
      WHERE info.#{target_column} = fact.target_id AND info.emotion = fact.emotion
      """,
      [now]
    )

    Repo.query!(
      """
      UPDATE cms.#{info_table} info
      SET user_ids = '{}'::roaringbitmap64, users_count = 0, updated_at = $1::timestamptz
      WHERE NOT EXISTS (
        SELECT 1
        FROM cms.#{fact_table} fact
        #{filter}
        AND fact.#{target_column} = info.#{target_column}
        AND fact.emotion = info.emotion
      )
      """,
      [now]
    )
  end

  defp insert_missing_report_infos(info_table, target_column, filter) do
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      INSERT INTO cms.#{info_table} (#{target_column}, inserted_at, updated_at)
      SELECT DISTINCT #{target_column}, $1::timestamptz, $1::timestamptz
      FROM cms.abuse_reports
      #{filter}
      ON CONFLICT (#{target_column}) DO NOTHING
      """,
      [now]
    )
  end

  defp count_report_drift(info_table, target_column, filter) do
    count!("""
    WITH fact AS (
      SELECT report.#{target_column} AS target_id,
             rb64_build(array_agg((item->'user'->>'user_id')::bigint)) AS users
      FROM cms.abuse_reports report
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(report.report_cases, '[]'::jsonb)) item
      #{filter}
      GROUP BY report.#{target_column}
    )
    SELECT count(*)
    FROM cms.#{info_table} info
    LEFT JOIN fact ON fact.target_id = info.#{target_column}
    WHERE info.reported_user_ids IS DISTINCT FROM COALESCE(fact.users, '{}'::roaringbitmap64)
    """)
  end

  defp rebuild_reports(info_table, target_column, filter) do
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      WITH fact AS (
        SELECT report.#{target_column} AS target_id,
               rb64_build(array_agg((item->'user'->>'user_id')::bigint)) AS users
        FROM cms.abuse_reports report
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(report.report_cases, '[]'::jsonb)) item
        #{filter}
        GROUP BY report.#{target_column}
      )
      UPDATE cms.#{info_table} info
      SET reported_user_ids = fact.users, updated_at = $1::timestamptz
      FROM fact
      WHERE info.#{target_column} = fact.target_id
      """,
      [now]
    )

    Repo.query!(
      """
      UPDATE cms.#{info_table} info
      SET reported_user_ids = '{}'::roaringbitmap64, updated_at = $1::timestamptz
      WHERE NOT EXISTS (
        SELECT 1
        FROM cms.abuse_reports report
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(report.report_cases, '[]'::jsonb)) item
        #{filter}
        AND report.#{target_column} = info.#{target_column}
      )
      """,
      [now]
    )
  end

  defp count!(sql) do
    %{rows: [[count]]} = Repo.query!(sql)
    count
  end

  defp target_column(thread), do: Registry.target_column(String.to_existing_atom(thread))

  defp fixed_count_column("upvoted_user_ids"), do: "upvotes_count"
  defp fixed_count_column("collected_user_ids"), do: "collects_count"
  defp fixed_count_column(_bitmap_column), do: nil
end
