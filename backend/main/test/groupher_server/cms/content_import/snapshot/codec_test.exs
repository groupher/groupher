defmodule GroupherServer.CMS.ContentImport.Snapshot.CodecTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, Snapshot}
  alias GroupherServer.CMS.ContentImport.Snapshot.Codec

  test "round-trips text and binary Entries and verifies their hashes" do
    snapshot =
      Snapshot.new!(%{
        platform: :github_repository,
        source_ref: "groupher/groupher",
        revision: "head-sha",
        fetched_at: ~U[2026-07-14 00:00:00Z],
        entries: [
          Entry.new!(%{
            external_ref: "docs/start.md",
            kind: :file,
            path: "docs/start.md",
            body: "# Start\n",
            body_format: :md
          }),
          Entry.new!(%{
            external_ref: "assets/logo.bin",
            kind: :asset,
            path: "assets/logo.bin",
            body: <<0, 255, 1>>
          })
        ]
      })

    assert {:ok, payload} = Codec.dump(snapshot)
    assert {:ok, restored} = Codec.load(payload)
    assert restored.manifest_hash == snapshot.manifest_hash
    assert Enum.map(restored.entries, & &1.body) == ["# Start\n", <<0, 255, 1>>]
  end

  test "rejects payload tampering" do
    entry = Entry.new!(%{external_ref: "docs/start.md", kind: :file, body: "Start"})

    snapshot =
      Snapshot.new!(%{
        platform: :github_repository,
        source_ref: "groupher/groupher",
        entries: [entry],
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    assert {:ok, payload} = Codec.dump(snapshot)
    tampered = String.replace(payload, "Start", "Changed")
    assert {:error, %{code: "snapshot_entry_hash_mismatch"}} = Codec.load(tampered)
  end
end
