defmodule GroupherServer.CMS.ContentImport.Persistence.SnapshotTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Persistence, Snapshot}
  alias GroupherServer.CMS.ContentImport.Persistence.Snapshot, as: PersistedSnapshot

  test "persists bounded manifest metadata without embedding Entry bodies" do
    entry =
      Entry.new!(%{
        external_ref: "docs/start.md",
        kind: :file,
        path: "docs/start.md",
        body: String.duplicate("large-body", 100),
        revision: "blob-sha"
      })

    snapshot =
      Snapshot.new!(%{
        platform: :github,
        source_ref: "groupher/groupher",
        revision: "head-sha",
        entries: [entry],
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    changeset = Persistence.snapshot_changeset(1, snapshot, "object://snapshots/1")
    assert changeset.valid?

    persisted = Ecto.Changeset.apply_changes(changeset)
    assert persisted.entry_count == 1
    assert persisted.payload_ref == "object://snapshots/1"
    assert get_in(persisted.entry_manifest, ["entries", Access.at(0), "revision"]) == "blob-sha"
    refute inspect(persisted.entry_manifest) =~ "large-body"
    assert PersistedSnapshot.__schema__(:type, :fetched_at) == :utc_datetime
  end
end
