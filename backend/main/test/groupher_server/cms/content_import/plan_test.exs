defmodule GroupherServer.CMS.ContentImport.PlanTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.Plan.Item
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, PlanPayload}

  test "requires unique source and target identity across items" do
    first = item("source:1", "target:1")

    assert {:error, %{code: "duplicate_plan_item_external_ref"}} =
             Plan.new(%{
               thread: :doc,
               items: [first, item("source:1", "target:2")],
               assets: [],
               payload: plan_payload()
             })

    assert {:error, %{code: "duplicate_plan_item_target_ref"}} =
             Plan.new(%{
               thread: :doc,
               items: [first, item("source:2", "target:1")],
               assets: [],
               payload: plan_payload()
             })
  end

  defp item(external_ref, target_ref) do
    Item.new!(%{
      external_ref: external_ref,
      target_ref: target_ref,
      action: :create,
      source_hash: String.duplicate("a", 64),
      payload:
        ItemPayload.new!(%{
          article_hash_id: target_ref,
          content: %{"status" => "normalized"}
        })
    })
  end

  defp plan_payload do
    PlanPayload.new!(%{
      schema_version: 1,
      source: %{"framework" => "test"},
      target: %{"thread" => "doc"},
      tree: %{"tabs" => []}
    })
  end
end
