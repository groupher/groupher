defmodule GroupherServer.Test.CMS.Interactions.EmotionRegistryTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Interactions.Registry

  test "accepts configured emotions without creating atoms" do
    assert {:ok, :beer} = Registry.decode_emotion("beer", :article)
  end

  test "unknown persisted emotion is an explicit error" do
    assert {:error, :unknown_emotion} = Registry.decode_emotion("release-only", :article)
  end
end
