defmodule GroupherServer.AlertWall.Commands.SubmitReport do
  @moduledoc """
  Persists a user report through AlertWall and the shared CommandPipeline Receipt.

  Business position:

      GraphQL report command
        -> SubmitReport CommandPipeline + Receipt
          -> target owner validates canonical subject
            -> AlertWall persists report and item
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias AlertWall.Model.UserReport
  alias CMS.Command.ConfirmationDefinition

  defmodule Target do
    @moduledoc """
    Canonical AlertWall report target resolved by its owning context.

        CMS/Accounts resolver -> typed Target -> SubmitReport CommandPipeline
    """
    defstruct [:owner, :target_type, :target_id, :community_id, :subject_ref]
  end

  @report_types [:spam, :harassment, :illegal_content, :impersonation, :other]

  @pipeline operation: :alert_wall_submit_report,
            access: :user,
            target: :target,
            params: [:report_type, :details],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation containing the canonical report result.

    Business position:

        SubmitReport CommandPipeline -> Receipt -> canonical AlertWall report
    """

    use ConfirmationDefinition,
      operation: :alert_wall_submit_report,
      data_keys: ["report_id"],
      field_types: %{"report_id" => :integer}
  end

  @doc "Submits a report for a target already resolved and authorized by CMS."
  def execute(target, report_type, details, actor, command_id)
      when is_map(target) and report_type in @report_types and is_binary(details) do
    execute_pipeline(struct(Target, target), report_type, details, actor, command_id)
  end

  def execute(_target, _report_type, _details, _actor, _command_id) do
    {:error, AlertWall.ErrorCat.invalid_report()}
  end

  receipt_pipeline execute_pipeline(target, report_type, details, actor, command_id) do
    prepare(fn -> prepare(target, report_type, details) end)
    gate(fn prepared -> authorize(prepared, actor) end)
    change(fn prepared -> submit(prepared, actor, command_id) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(&present_report/1)
  end

  defp prepare(%Target{} = target, report_type, details) do
    with true <- valid_target?(target),
         true <- String.length(details) <= 8_000 do
      attrs =
        target
        |> Map.put(:report_type, report_type |> Atom.to_string() |> String.upcase())
        |> Map.put(:details, details)

      {:ok, attrs,
       target: {attrs.target_type, attrs.target_id},
       params: %{
         report_type: report_type,
         details: details,
         community_id: attrs.community_id,
         subject_ref: attrs.subject_ref
       }}
    else
      _ -> {:error, AlertWall.ErrorCat.invalid_report()}
    end
  end

  defp authorize(prepared, %{id: id}) when is_integer(id), do: {:ok, prepared}
  defp authorize(_prepared, _actor), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp submit(prepared, %{id: reporter_id}, command_id) do
    attrs = Map.put(prepared, :reporter_id, reporter_id)

    case AlertWall.Persist.submit_report_in_transaction(attrs, command_id) do
      {:ok, %UserReport{id: report_id}} ->
        {:ok, %Confirmation{data: %{"report_id" => report_id}}}

      {:error, _reason} = error ->
        error
    end
  end

  defp present_report(%Confirmation{data: %{"report_id" => report_id}}) do
    case Repo.get(UserReport, report_id) do
      %UserReport{} = report -> {:ok, report}
      nil -> {:error, AlertWall.ErrorCat.invalid_report()}
    end
  end

  defp present_report(_confirmation), do: {:error, AlertWall.ErrorCat.invalid_report()}

  defp valid_target?(
         %{
           owner: owner,
           target_type: target_type,
           target_id: target_id,
           subject_ref: subject_ref
         } = target
       ) do
    owner in [:cms, :accounts] and
      ((owner == :cms and target_type in [:article, :comment, :doc]) or
         (owner == :accounts and target_type == :user)) and
      is_binary(target_id) and target_id != "" and is_binary(subject_ref) and subject_ref != "" and
      (target_type != :doc or is_nil(Map.get(target, :community_id)))
  end
end
