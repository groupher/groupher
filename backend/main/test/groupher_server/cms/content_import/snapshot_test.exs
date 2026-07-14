defmodule GroupherServer.CMS.ContentImport.SnapshotTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Snapshot}

  test "manifest hash is independent of entry order and fetch metadata" do
    first = Entry.new!(%{external_ref: "file:a", kind: :file, body: "A", revision: "blob-a"})
    second = Entry.new!(%{external_ref: "file:b", kind: :file, body: "B", revision: "blob-b"})

    left =
      Snapshot.new!(%{
        platform: :github_repository,
        source_ref: "owner/repo@main:/docs",
        revision: "head-a",
        checkpoint: %{cursor: "one"},
        entries: [first, second],
        fetched_at: ~U[2026-07-14 00:00:00Z],
        adapter_version: "1"
      })

    right =
      Snapshot.new!(%{
        platform: :github_repository,
        source_ref: "owner/repo@main:/docs",
        revision: "head-b",
        checkpoint: %{cursor: "two"},
        entries: [second, first],
        fetched_at: ~U[2026-07-14 01:00:00Z],
        adapter_version: "1"
      })

    assert left.manifest_hash == right.manifest_hash
    refute left.revision == first.revision
  end

  test "rejects duplicate external refs" do
    first = Entry.new!(%{external_ref: "same", kind: :file, body: "A"})
    second = Entry.new!(%{external_ref: "same", kind: :file, body: "B"})

    assert {:error, %{code: "duplicate_entry_external_ref"}} =
             Snapshot.new(%{
               platform: :archive_zip,
               source_ref: "upload:1",
               entries: [first, second],
               fetched_at: ~U[2026-07-14 00:00:00Z]
             })
  end
end
