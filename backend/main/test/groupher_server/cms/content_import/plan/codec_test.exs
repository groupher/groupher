defmodule GroupherServer.CMS.ContentImport.Plan.CodecTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Codec, Item}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, PlanPayload}

  test "round-trips private Plan payload and staging refs" do
    plan =
      Plan.new!(%{
        thread: :doc,
        items: [
          Item.new!(%{
            external_ref: "docs/start.md",
            target_ref: "article:1",
            action: :create,
            source_hash: String.duplicate("a", 64),
            payload:
              ItemPayload.new!(%{
                article_hash_id: "article:1",
                content: %{"body" => "private-body"}
              })
          })
        ],
        assets: [
          Asset.new!(%{
            asset_key: "logo",
            source: {:remote_url, "https://example.com/logo.png"},
            status: :ready,
            content_hash: String.duplicate("b", 64),
            staging_ref: "staging://private/logo"
          })
        ],
        payload:
          PlanPayload.new!(%{
            schema_version: 1,
            source: %{"framework" => "test"},
            target: %{"thread" => "doc"},
            tree: %{"tabs" => []}
          })
      })

    assert {:ok, payload} = Codec.dump(plan)
    assert {:ok, restored} = Codec.load(payload)
    assert restored == plan
    assert Codec.hash(restored) == Codec.hash(plan)
    assert Codec.summary(plan)["itemCount"] == 1
  end
end
