defmodule GroupherServer.CMS.ContentImport.IdempotencyKeyTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.IdempotencyKey

  test "is stable across map ordering and changes for effective options or run nonce" do
    base = %{
      connection_id: 1,
      snapshot_manifest_hash: String.duplicate("a", 64),
      thread: :doc,
      scope_ref: "import",
      effective_options: %{"locale" => "zh", "branch" => "import"}
    }

    assert {:ok, first} = IdempotencyKey.build(base)

    assert {:ok, ^first} =
             IdempotencyKey.build(%{
               base
               | effective_options: %{"branch" => "import", "locale" => "zh"}
             })

    assert {:ok, changed} =
             IdempotencyKey.build(%{base | effective_options: %{"branch" => "other"}})

    assert changed != first

    assert {:ok, ^first} =
             IdempotencyKey.build(Map.put(base, :preparation_hash, String.duplicate("b", 64)))

    assert {:ok, forced} = IdempotencyKey.build(Map.put(base, :run_nonce, "manual-2"))
    assert forced != first
  end

  test "rejects runtime functions in effective options" do
    assert {:error, %{code: "invalid_import_idempotency_options"}} =
             IdempotencyKey.build(%{
               connection_id: 1,
               snapshot_manifest_hash: String.duplicate("a", 64),
               thread: :doc,
               effective_options: %{id_generator: fn -> "id" end}
             })
  end
end
