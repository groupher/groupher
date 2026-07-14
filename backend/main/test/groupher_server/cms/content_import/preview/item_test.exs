defmodule GroupherServer.CMS.ContentImport.Preview.ItemTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Plan.Item, as: PlanItem
  alias GroupherServer.CMS.ContentImport.Preview.Item, as: PreviewItem
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, ItemPreview}

  test "preserves common identity while accepting a safe thread projection" do
    plan_item =
      PlanItem.new!(%{
        external_ref: "docs/start.md",
        target_ref: "article:1",
        action: :create,
        source_hash: String.duplicate("a", 64),
        payload: ItemPayload.new!(%{article_hash_id: "article:1", content: %{}})
      })

    preview =
      PreviewItem.from_plan_item(
        plan_item,
        %ItemPreview{title: "Start", content_status: "normalized"}
      )

    assert preview.external_ref == plan_item.external_ref
    assert preview.target_ref == plan_item.target_ref
    assert preview.payload.title == "Start"
  end
end
