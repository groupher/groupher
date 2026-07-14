defmodule GroupherServer.CMS.ContentImport.Persistence.MappingTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Persistence.Mapping

  test "stores only successful source/local checkpoints using UTC time" do
    changeset =
      Mapping.changeset(%Mapping{}, %{
        connection_id: 1,
        snapshot_id: 2,
        external_ref: "release:42",
        thread: :changelog,
        target_ref: "changelog:public-ref",
        last_imported_revision: "revision:2",
        last_imported_source_hash: String.duplicate("a", 64),
        last_imported_local_hash: String.duplicate("b", 64),
        last_imported_at: ~U[2026-07-14 03:00:00Z]
      })

    assert changeset.valid?
    assert Mapping.__schema__(:type, :last_imported_at) == :utc_datetime
  end
end
