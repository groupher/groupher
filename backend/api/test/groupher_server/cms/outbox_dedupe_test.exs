defmodule GroupherServer.CMS.OutboxDedupeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Outbox.DedupeKey

  test "encodes ordered typed dimensions deterministically" do
    assert DedupeKey.encode([:provider_delete, 42, "asset-key"]) ==
             DedupeKey.encode([:provider_delete, 42, "asset-key"])

    refute DedupeKey.encode([:provider_delete, 42, "asset-key"]) ==
             DedupeKey.encode([42, :provider_delete, "asset-key"])
  end

  test "distinguishes nil, empty strings, types, and ambiguous boundaries" do
    keys = [
      DedupeKey.encode([nil]),
      DedupeKey.encode([""]),
      DedupeKey.encode(["1", 23]),
      DedupeKey.encode(["12", 3]),
      DedupeKey.encode([:asset, "a:b"]),
      DedupeKey.encode([:asset, "a", "b"])
    ]

    assert length(keys) == MapSet.size(MapSet.new(keys))
  end

  test "rejects dimensions without a stable supported representation" do
    assert_raise ArgumentError, "unsupported Outbox dedupe dimension", fn ->
      DedupeKey.encode([self()])
    end
  end
end
