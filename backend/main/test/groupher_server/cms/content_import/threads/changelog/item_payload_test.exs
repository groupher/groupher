defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPayload

  test "keeps the normalized body private while producing a bounded item summary" do
    payload =
      ItemPayload.new!(%{
        title: "Version 1",
        tag_name: "v1.0.0",
        content: %{"status" => "normalized", "body" => "private body"}
      })

    assert ItemPayload.bounded_preview(payload) == %{
             "contentStatus" => "normalized",
             "prerelease" => false,
             "tagName" => "v1.0.0",
             "title" => "Version 1"
           }

    assert ItemPayload.encode(payload)["content"]["body"] == "private body"
  end
end
