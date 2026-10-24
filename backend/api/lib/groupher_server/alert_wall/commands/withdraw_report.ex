defmodule GroupherServer.AlertWall.Commands.WithdrawReport do
  @moduledoc """
  Withdraws a reporter-owned AlertWall report through CommandPipeline and Receipt.

  Business position:

      Reporter withdraw command
        -> WithdrawReport CommandPipeline + Receipt
          -> AlertWall verifies ownership
            -> report and item projection update
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias AlertWall.Model.UserReport
  alias CMS.Command.ConfirmationDefinition

  @pipeline operation: :alert_wall_withdraw_report,
            access: :user,
            target: :report_id,
            params: [],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation containing the canonical withdrawal result.

    Business position:

        WithdrawReport CommandPipeline -> Receipt -> canonical report state
    """

    use ConfirmationDefinition,
      operation: :alert_wall_withdraw_report,
      data_keys: ["report_id"],
      field_types: %{"report_id" => :integer}
  end

  @doc "Withdraws one report owned by the current account."
  def execute(report_id, actor, command_id) when is_integer(report_id) and report_id > 0 do
    execute_pipeline(report_id, actor, command_id)
  end

  def execute(_report_id, _actor, _command_id) do
    {:error, AlertWall.ErrorCat.invalid_report()}
  end

  receipt_pipeline execute_pipeline(report_id, actor, command_id) do
    prepare(fn -> {:ok, report_id, target: {:alert_report, report_id}, params: %{}} end)
    gate(fn id -> authorize(id, actor) end)
    change(fn id -> withdraw(id, actor) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(&present_report/1)
  end

  defp authorize(report_id, %{id: reporter_id}) when is_integer(reporter_id) do
    case Repo.get(UserReport, report_id) do
      %UserReport{reporter_id: ^reporter_id} -> {:ok, report_id}
      _ -> {:error, AlertWall.ErrorCat.report_not_found()}
    end
  end

  defp authorize(_report_id, _actor), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp withdraw(report_id, %{id: reporter_id}) do
    with {:ok, %{report: report}} <-
           AlertWall.Persist.withdraw_report_in_transaction(report_id, reporter_id) do
      {:ok, %Confirmation{data: %{"report_id" => report.id}}}
    end
  end

  defp present_report(%Confirmation{data: %{"report_id" => report_id}}) do
    case Repo.get(UserReport, report_id) do
      %UserReport{} = report -> {:ok, report}
      nil -> {:error, AlertWall.ErrorCat.report_not_found()}
    end
  end

  defp present_report(_confirmation), do: {:error, AlertWall.ErrorCat.invalid_report()}
end
