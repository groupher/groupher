defmodule GroupherServer.CMS.ContentImport.DiffTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Diff, Entry, Mapping, Snapshot}

  test "derives source and local change states without persisting a second truth" do
    entries = [
      entry("new", "new"),
      entry("same", "same"),
      entry("source", "source-v2"),
      entry("conflict", "source-v2")
    ]

    snapshot = snapshot(entries)

    mappings = [
      mapping("same", "target:same", entry_hash("same"), "local:same"),
      mapping("source", "target:source", entry_hash("source-v1"), "local:source"),
      mapping("conflict", "target:conflict", entry_hash("source-v1"), "local:old"),
      mapping("deleted", "target:deleted", entry_hash("deleted"), "local:deleted")
    ]

    diff =
      Diff.build(snapshot, mappings, %{
        "target:same" => "local:same",
        "target:source" => "local:source",
        "target:conflict" => "local:new",
        "target:deleted" => "local:deleted"
      })

    assert status(diff, "new") == :new
    assert status(diff, "same") == :in_sync
    assert status(diff, "source") == :source_updated
    assert status(diff, "conflict") == :conflict
    assert status(diff, "deleted") == :source_deleted
    assert diff.summary.new == 1
    assert diff.summary.source_deleted == 1
  end

  test "revision changes do not affect a hash-based diff" do
    original = entry("same", "body", revision: "blob-v1")
    refreshed = entry("same", "body", revision: "blob-v2")

    mapping =
      mapping("same", "target:same", original.content_hash, "local:same", "blob-v1")

    diff = Diff.build(snapshot([refreshed]), [mapping], %{"target:same" => "local:same"})
    assert status(diff, "same") == :in_sync
  end

  test "detects a local-only update" do
    source = entry("same", "body")
    mapping = mapping("same", "target:same", source.content_hash, "local:old")
    diff = Diff.build(snapshot([source]), [mapping], %{"target:same" => "local:new"})
    assert status(diff, "same") == :local_updated
  end

  defp status(diff, external_ref) do
    diff.items |> Enum.find(&(&1.external_ref == external_ref)) |> Map.fetch!(:status)
  end

  defp entry(external_ref, body, opts \\ []) do
    Entry.new!(%{
      external_ref: external_ref,
      kind: :record,
      body: body,
      revision: Keyword.get(opts, :revision)
    })
  end

  defp entry_hash(body), do: entry("hash-source", body).content_hash

  defp mapping(external_ref, target_ref, source_hash, local_hash, revision \\ nil) do
    Mapping.new!(%{
      connection_ref: "connection:1",
      external_ref: external_ref,
      thread: :doc,
      target_ref: target_ref,
      last_imported_revision: revision,
      last_imported_source_hash: source_hash,
      last_imported_local_hash: local_hash,
      last_imported_at: ~U[2026-07-14 00:00:00Z]
    })
  end

  defp snapshot(entries) do
    Snapshot.new!(%{
      platform: :test,
      source_ref: "fixture:diff",
      entries: entries,
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end
end
