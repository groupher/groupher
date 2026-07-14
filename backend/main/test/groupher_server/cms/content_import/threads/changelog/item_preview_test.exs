defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPreviewTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.{ItemPayload, ItemPreview}

  test "does not expose normalized content" do
    payload =
      ItemPayload.new!(%{
        title: "Version 1",
        prerelease: true,
        content: %{"status" => "normalized", "body" => "private body"}
      })

    preview = ItemPreview.from_item_payload(payload)

    assert preview.title == "Version 1"
    assert preview.prerelease
    assert preview.content_status == "normalized"
    refute Map.has_key?(Map.from_struct(preview), :content)
  end
end
