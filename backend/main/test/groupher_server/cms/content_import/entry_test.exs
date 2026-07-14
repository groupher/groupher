defmodule GroupherServer.CMS.ContentImport.EntryTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Entry

  test "normalizes text line endings and exactly one trailing newline" do
    unix = Entry.new!(%{external_ref: "doc:intro", kind: :file, body: "# Intro\nbody\n"})

    windows =
      Entry.new!(%{external_ref: "doc:intro", kind: :file, body: "# Intro\r\nbody\r\n\r\n"})

    assert unix.content_hash == windows.content_hash
  end

  test "preserves meaningful body whitespace" do
    left = Entry.new!(%{external_ref: "doc:intro", kind: :file, body: "```\ncode  \n```"})
    right = Entry.new!(%{external_ref: "doc:intro", kind: :file, body: "```\ncode\n```"})

    refute left.content_hash == right.content_hash
  end

  test "canonicalizes structured map keys and ignores volatile metadata" do
    left =
      Entry.new!(%{
        external_ref: "release:1",
        kind: :record,
        body: %{"title" => "v1", "items" => [%{"b" => 2, "a" => 1}]},
        metadata: %{request_id: "one", stable: %{z: 2, a: 1}}
      })

    right =
      Entry.new!(%{
        external_ref: "release:1",
        kind: :record,
        body: %{"items" => [%{"a" => 1, "b" => 2}], "title" => "v1"},
        metadata: %{"stable" => %{"a" => 1, "z" => 2}, "requestId" => "two"}
      })

    assert left.content_hash == right.content_hash
  end

  test "revision is provenance and does not change the content hash" do
    left = Entry.new!(%{external_ref: "file:a", kind: :file, body: "same", revision: "blob-a"})
    right = Entry.new!(%{external_ref: "file:a", kind: :file, body: "same", revision: "blob-b"})

    assert left.content_hash == right.content_hash
  end

  test "asset bodies are hashed as raw binary" do
    left = Entry.new!(%{external_ref: "asset:a", kind: :asset, body: <<1, 13, 10, 2>>})
    right = Entry.new!(%{external_ref: "asset:a", kind: :asset, body: <<1, 10, 2>>})

    refute left.content_hash == right.content_hash
  end
end
