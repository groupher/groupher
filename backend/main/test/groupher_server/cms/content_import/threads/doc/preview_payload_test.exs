defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PreviewPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{PlanPayload, PreviewPayload}

  test "projects only the Doc preview aggregate" do
    plan_payload =
      PlanPayload.new!(%{
        schema_version: 1,
        source: %{"framework" => "nextra"},
        target: %{"thread" => "doc"},
        tree: %{"tabs" => []}
      })

    assert %PreviewPayload{source: source, target: target, tree: tree} =
             PreviewPayload.from_plan_payload(plan_payload)

    assert source == plan_payload.source
    assert target == plan_payload.target
    assert tree == plan_payload.tree
  end
end
