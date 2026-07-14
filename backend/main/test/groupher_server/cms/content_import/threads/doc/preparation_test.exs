defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PreparationTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Snapshot}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation

  test "binds the parsed tree to one Snapshot manifest with a deterministic hash" do
    snapshot = snapshot("First")
    tree = %{"source" => %{"framework" => "nextra"}, "navigation" => []}

    first = Preparation.new!(snapshot, :nextra, tree)
    second = Preparation.new!(snapshot, :nextra, tree, [%{code: "warning"}])

    assert first.snapshot_manifest_hash == snapshot.manifest_hash
    assert first.preparation_hash == second.preparation_hash
    assert Preparation.matches_snapshot?(first, snapshot)
    refute Preparation.matches_snapshot?(first, snapshot("Second"))

    changed = Preparation.new!(snapshot, :nextra, Map.put(tree, "navigation", [%{"id" => "one"}]))
    assert changed.preparation_hash != first.preparation_hash
  end

  test "rejects unsupported frameworks and unstructured trees" do
    snapshot = snapshot("First")

    assert {:error, %{code: "invalid_doc_preparation_framework"}} =
             Preparation.new(snapshot, :unknown, %{})

    assert {:error, %{code: "invalid_doc_preparation_tree"}} =
             Preparation.new(snapshot, :nextra, [])
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
