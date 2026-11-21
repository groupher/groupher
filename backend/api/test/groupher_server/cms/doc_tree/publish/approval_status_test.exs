defmodule GroupherServer.CMS.DocTree.Publish.ApprovalStatusTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.ApprovalStatus

  @queue %{
    approval_required: true,
    allow_self_approval: false,
    has_members: true,
    queue_revision: 2,
    approval_policy_revision: 1
  }
  @approval %{
    queue_revision: 2,
    approval_policy_revision: 1,
    allow_self_approval: false,
    plan_format_version: 1,
    tree_plan: %{"plan_format_version" => 1, "articles" => []}
  }
  @supported [1]
  @plan %{format_version: 1, payload: @approval.tree_plan}

  test "disabled, empty, stale and unsupported states do not compute a plan" do
    never = fn -> flunk("plan should not be calculated") end

    assert {:ok, %{status: nil}} =
             ApprovalStatus.derive(
               %{@queue | approval_required: false},
               @approval,
               @supported,
               never
             )

    assert {:ok, %{status: :idle}} =
             ApprovalStatus.derive(%{@queue | has_members: false}, @approval, @supported, never)

    assert {:ok, %{status: :pending}} = ApprovalStatus.derive(@queue, nil, @supported, never)

    assert {:ok, %{status: :pending}} =
             ApprovalStatus.derive(%{@queue | queue_revision: 3}, @approval, @supported, never)

    assert {:ok, %{status: :pending}} =
             ApprovalStatus.derive(
               %{@queue | approval_policy_revision: 2},
               @approval,
               @supported,
               never
             )

    assert {:ok, %{status: :needs_reapproval, consistency_error: false}} =
             ApprovalStatus.derive(@queue, @approval, [], never)
  end

  test "matching plan is approved; equal-format structural mismatch is an inconsistency" do
    assert {:ok, %{status: :approved, consistency_error: false}} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn -> {:ok, @plan} end)

    assert {:ok, %{status: :needs_reapproval, consistency_error: true}} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn ->
               {:ok, %{@plan | payload: Map.put(@plan.payload, "articles", [%{"revision" => 2}])}}
             end)
  end

  test "fixed snapshot source mismatch needs reapproval at the same queue revision" do
    assert {:ok, %{status: :needs_reapproval, consistency_error: true}} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn ->
               {:error, :approval_facts_mismatch}
             end)
  end

  test "plan format changes require approval without reporting equal-version corruption" do
    assert {:ok, %{status: :needs_reapproval, consistency_error: false}} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn ->
               {:ok, %{@plan | format_version: 2}}
             end)
  end

  test "mismatched policy facts and planner errors fail closed" do
    assert {:error, :approval_policy_inconsistent} =
             ApprovalStatus.derive(
               @queue,
               %{@approval | allow_self_approval: true},
               @supported,
               fn ->
                 {:ok, @plan}
               end
             )

    assert {:error, :planner_failed} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn ->
               {:error, :planner_failed}
             end)

    assert {:error, :invalid_plan} =
             ApprovalStatus.derive(@queue, @approval, @supported, fn -> {:ok, %{}} end)
  end
end
