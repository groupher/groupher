defmodule GroupherServer.CMS.DocTree.Publish.ApprovalStatus do
  @moduledoc """
  Derives Docs approval status from the current queue, policy and fixed approval.

      queue + policy revision + approval -> cheap status -> optional structured plan comparison

  The caller supplies a consistent authorized snapshot and owns logging and
  notification. This module neither persists status nor admits a publish.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.Plan

  @doc "Returns the derived status and whether equal-version plan facts disagree."
  def derive(queue, approval, supported_formats, current_plan)
      when is_map(queue) and is_list(supported_formats) and is_function(current_plan, 0) do
    with {:ok, :pass} <- validate_queue(queue) do
      evaluate(queue, approval, supported_formats, current_plan)
    end
  end

  def derive(_queue, _approval, _supported_formats, _current_plan) do
    {:error, :invalid_approval_status_input}
  end

  defp validate_queue(%{
         approval_required: required,
         allow_self_approval: allow_self,
         has_members: has_members,
         queue_revision: queue_revision,
         approval_policy_revision: policy_revision
       })
       when is_boolean(required) and is_boolean(allow_self) and is_boolean(has_members) and
              is_integer(queue_revision) and queue_revision >= 0 and is_integer(policy_revision) and
              policy_revision >= 0 do
    {:ok, :pass}
  end

  defp validate_queue(_queue), do: {:error, :invalid_approval_status_input}

  defp evaluate(%{approval_required: false}, _approval, _supported, _current_plan) do
    result(nil)
  end

  defp evaluate(%{has_members: false}, _approval, _supported, _current_plan), do: result(:idle)
  defp evaluate(_queue, nil, _supported, _current_plan), do: result(:pending)

  defp evaluate(
         queue,
         %{
           queue_revision: approved_revision,
           approval_policy_revision: approved_policy_revision,
           allow_self_approval: approved_allow_self,
           plan_format_version: format_version,
           tree_plan: approved_plan
         },
         supported,
         current_plan
       )
       when is_integer(approved_revision) and approved_revision >= 0 and
              is_integer(approved_policy_revision) and approved_policy_revision >= 0 and
              is_boolean(approved_allow_self) and is_integer(format_version) and
              format_version > 0 and is_map(approved_plan) do
    cond do
      approved_revision != queue.queue_revision or
          approved_policy_revision != queue.approval_policy_revision ->
        result(:pending)

      approved_allow_self != queue.allow_self_approval ->
        {:error, :approval_policy_inconsistent}

      format_version not in supported ->
        result(:needs_reapproval)

      true ->
        compare_plan(current_plan.(), format_version, approved_plan)
    end
  end

  defp evaluate(_queue, _approval, _supported, _current_plan) do
    {:error, :invalid_approval_status_input}
  end

  defp compare_plan({:ok, %{format_version: version, payload: payload} = plan}, version, approved)
       when is_map(payload) do
    if Plan.matches?(approved, plan) do
      result(:approved)
    else
      {:ok, %{status: :needs_reapproval, consistency_error: true}}
    end
  end

  defp compare_plan({:ok, %{format_version: version, payload: payload}}, _, _)
       when is_integer(version) and is_map(payload) do
    result(:needs_reapproval)
  end

  defp compare_plan({:error, :approval_facts_mismatch}, _, _) do
    {:ok, %{status: :needs_reapproval, consistency_error: true}}
  end

  defp compare_plan({:error, _reason} = error, _version, _approved), do: error
  defp compare_plan(_result, _version, _approved), do: {:error, :invalid_plan}

  defp result(status), do: {:ok, %{status: status, consistency_error: false}}
end
