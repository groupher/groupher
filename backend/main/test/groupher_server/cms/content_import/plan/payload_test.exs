defmodule GroupherServer.CMS.ContentImport.Plan.PayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Plan.Payload
  alias GroupherServer.CMS.ContentImport.Threads.Changelog
  alias GroupherServer.CMS.ContentImport.Threads.Doc

  test "requires aggregate and item payloads to match the Plan thread" do
    doc_payload =
      Doc.PlanPayload.new!(%{
        schema_version: 1,
        source: %{},
        target: %{},
        tree: %{}
      })

    changelog_item = Changelog.ItemPayload.new!(%{content: %{}})

    assert {:ok, ^doc_payload} = Payload.validate_plan(:doc, doc_payload)

    assert {:error, %{code: "invalid_thread_payload"}} =
             Payload.validate_plan(:changelog, doc_payload)

    refute Payload.valid_item?(%{})
    assert Payload.valid_item?(changelog_item)
  end
end
