defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Preparation.CodecTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Snapshot}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation.Codec

  test "round-trips only against the Snapshot that produced the Preparation" do
    snapshot = snapshot("First")
    preparation = Preparation.new!(snapshot, :nextra, %{"source" => %{"framework" => "nextra"}})

    assert {:ok, payload} = Codec.dump(preparation)
    assert {:ok, restored} = Codec.load(payload, snapshot)
    assert restored == preparation

    assert {:error, %{code: "doc_preparation_snapshot_mismatch"}} =
             Codec.load(payload, snapshot("Second"))
  end

  defp snapshot(body) do
    Snapshot.new!(%{
      platform: :test,
      source_ref: "fixture:nextra",
      entries: [Entry.new!(%{external_ref: "docs/start.md", kind: :file, body: body})],
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end
end
