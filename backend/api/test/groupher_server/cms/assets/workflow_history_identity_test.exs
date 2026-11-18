defmodule GroupherServer.Test.CMS.Assets.WorkflowHistoryIdentityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Assets.Workflow

  test "workflow steps retain distinct operation identities across retries" do
    assert {:ok, run} =
             Workflow.ensure_run(%{
               workflow_ref: "history-identity:#{Ecto.UUID.generate()}",
               workflow_type: "asset_replacement_apply",
               resource_type: "asset_replacement_plan",
               resource_id: "test",
               status: :pending
             })

    attrs = %{
      step_ref: "article:1:cover",
      resource_type: "article_asset_ref",
      resource_id: "1",
      status: :pending,
      payload: %{},
      result: %{},
      attempts: 0
    }

    assert {:ok, first} = Workflow.ensure_step(run, attrs)
    assert {:ok, retry} = Workflow.ensure_step(run, attrs)
    assert {:ok, second} = Workflow.ensure_step(run, %{attrs | step_ref: "article:1:inline"})
    assert {:ok, _} = Ecto.UUID.cast(first.operation_ref)
    assert retry.operation_ref == first.operation_ref
    refute second.operation_ref == first.operation_ref
  end
end
