defmodule GroupherServer.CMS.Interactions.Audit do
  @moduledoc """
  Routes operational checks for Interaction facts and derived read state.

  Audit is not part of the normal request path and this facade contains no SQL.

      audit job / operator -> Audit -> Projection / Report
  """

  alias __MODULE__.{Projection, Report}

  @doc """
  Verifies bitmap/count projections and repairs drift atomically.

  ## Examples

      Audit.verify_and_repair()

  """
  @spec verify_and_repair() :: {:ok, %{repairs: non_neg_integer()}} | {:error, term()}
  defdelegate verify_and_repair(), to: Projection

  @doc """
  Returns report fact issues without changing data.

  ## Examples

      Audit.report_fact_issues()

  """
  @spec report_fact_issues() :: {:ok, %{issue_count: non_neg_integer(), issues: [map()]}}
  defdelegate report_fact_issues(), to: Report
end
