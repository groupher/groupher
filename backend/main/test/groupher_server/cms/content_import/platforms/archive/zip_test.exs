defmodule GroupherServer.CMS.ContentImport.Platforms.Archive.ZipTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Platforms.Archive.Zip

  test "creates a deterministic Snapshot from an in-memory ZIP" do
    archive = archive!([{"docs/index.md", "# Home"}, {"docs/logo.svg", "<svg />"}])

    assert {:ok, snapshot} =
             Zip.fetch(%{archive: archive}, fetched_at: ~U[2026-07-14 00:00:00Z])

    assert snapshot.platform == :archive_zip
    assert snapshot.revision
    assert snapshot.source_ref == "upload:#{snapshot.revision}"

    assert Enum.map(snapshot.entries, &{&1.external_ref, &1.kind}) == [
             {"docs/index.md", :file},
             {"docs/logo.svg", :asset}
           ]
  end

  test "rejects path traversal before extraction" do
    archive = archive!([{"../outside.md", "no"}])

    assert {:error, %{code: "unsafe_zip_path"}} = Zip.fetch(%{archive: archive}, [])
  end

  test "rejects suspicious compression ratios" do
    archive = archive!([{"docs/large.md", String.duplicate("a", 20_000)}])

    assert {:error, %{code: "zip_compression_ratio_exceeded"}} =
             Zip.fetch(%{archive: archive}, max_compression_ratio: 2)
  end

  defp archive!(files, opts \\ []) do
    entries = Enum.map(files, fn {path, body} -> {String.to_charlist(path), body} end)
    {:ok, {_name, archive}} = :zip.create(~c"fixture.zip", entries, [:memory | opts])
    archive
  end
end
