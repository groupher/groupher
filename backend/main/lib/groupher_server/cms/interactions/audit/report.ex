defmodule GroupherServer.CMS.Interactions.Audit.Report do
  @moduledoc """
  Detects invalid or ambiguous embedded Artiment report facts without repair.

      operator -> Audit.Report -> report issue inventory
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.Matcher

  @report_threads ~w(post blog changelog doc comment)

  @doc """
  Returns report fact issues without changing data.

  ## Examples

      Audit.Report.report_fact_issues()

  """
  @spec report_fact_issues() ::
          {:ok, %{issue_count: non_neg_integer(), issues: [map()]}} | {:error, term()}
  def report_fact_issues do
    Repo.transaction(fn ->
      issues = Enum.flat_map(@report_threads, &issues_for/1)
      %{issue_count: length(issues), issues: issues}
    end)
  end

  defp issues_for(thread) do
    target_column = target_column(thread)

    %{rows: rows} =
      Repo.query!("""
      WITH reports AS (
        SELECT report.id AS report_id,
               report.#{target_column} AS target_id,
               report.report_cases_count AS stored_count,
               COALESCE(report.report_cases, '[]'::jsonb) AS report_cases
        FROM cms.abuse_reports report
        WHERE report.#{target_column} IS NOT NULL
      ), cases AS (
        SELECT report.report_id,
               report.target_id,
               item.ordinality::bigint AS case_position,
               CASE
                 WHEN item.value->'user'->>'user_id' ~ '^[1-9][0-9]*$'
                 THEN (item.value->'user'->>'user_id')::bigint
               END AS reporter_user_id
        FROM reports report
        CROSS JOIN LATERAL jsonb_array_elements(report.report_cases)
          WITH ORDINALITY AS item(value, ordinality)
      ), issues AS (
        SELECT 'multiple_report_rows'::text AS issue,
               NULL::bigint AS report_id,
               target_id,
               NULL::bigint AS reporter_user_id,
               count(*)::bigint AS actual_count,
               NULL::bigint AS stored_count
        FROM reports
        GROUP BY target_id
        HAVING count(*) > 1

        UNION ALL

        SELECT 'duplicate_reporter_cases',
               NULL::bigint,
               target_id,
               reporter_user_id,
               count(*)::bigint,
               NULL::bigint
        FROM cases
        WHERE reporter_user_id IS NOT NULL
        GROUP BY target_id, reporter_user_id
        HAVING count(*) > 1

        UNION ALL

        SELECT 'orphan_reporter_case',
               cases.report_id,
               cases.target_id,
               cases.reporter_user_id,
               cases.case_position,
               NULL::bigint
        FROM cases
        LEFT JOIN account.users account_user ON account_user.id = cases.reporter_user_id
        WHERE cases.reporter_user_id IS NULL OR account_user.id IS NULL

        UNION ALL

        SELECT 'empty_report_cases',
               report_id,
               target_id,
               NULL::bigint,
               0::bigint,
               stored_count::bigint
        FROM reports
        WHERE jsonb_array_length(report_cases) = 0

        UNION ALL

        SELECT 'report_cases_count_mismatch',
               report_id,
               target_id,
               NULL::bigint,
               jsonb_array_length(report_cases)::bigint,
               stored_count::bigint
        FROM reports
        WHERE stored_count IS DISTINCT FROM jsonb_array_length(report_cases)
      )
      SELECT issue, report_id, target_id, reporter_user_id, actual_count, stored_count
      FROM issues
      ORDER BY issue, target_id, reporter_user_id NULLS FIRST, report_id NULLS FIRST
      """)

    keys = [:issue, :report_id, :target_id, :reporter_user_id, :actual_count, :stored_count]

    Enum.map(rows, fn row ->
      keys
      |> Enum.zip(row)
      |> Map.new()
      |> Map.put(:artiment, String.to_existing_atom(thread))
    end)
  end

  defp target_column(thread) do
    {:ok, info} = Matcher.match_interaction(String.to_existing_atom(thread))
    Atom.to_string(info.foreign_key)
  end
end
