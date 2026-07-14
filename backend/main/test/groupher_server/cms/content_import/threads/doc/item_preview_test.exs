defmodule GroupherServer.CMS.ContentImport.Threads.Doc.ItemPreviewTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, ItemPreview}

  test "does not expose normalized content" do
    payload =
      ItemPayload.new!(%{
        article_hash_id: "article:1",
        title: "Start",
        content: %{"status" => "normalized", "body" => "private body"}
      })

    preview = ItemPreview.from_item_payload(payload)

    assert preview.title == "Start"
    assert preview.content_status == "normalized"
    refute Map.has_key?(Map.from_struct(preview), :content)
  end
end
