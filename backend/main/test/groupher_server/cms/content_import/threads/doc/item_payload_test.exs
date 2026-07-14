defmodule GroupherServer.CMS.ContentImport.Threads.Doc.ItemPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.ItemPayload

  test "keeps the normalized body private while producing a bounded item summary" do
    payload =
      ItemPayload.new!(%{
        article_hash_id: "article:1",
        title: "Start",
        content: %{"status" => "normalized", "body" => "private body"}
      })

    assert ItemPayload.bounded_preview(payload) == %{
             "contentStatus" => "normalized",
             "title" => "Start"
           }

    assert ItemPayload.encode(payload)["content"]["body"] == "private body"
  end
end
