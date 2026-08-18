defmodule GroupherServer.Test.CMS.Interactions.EmotionTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Interactions.Emotion
  alias GroupherServer.ErrorCat.Error

  test "accepts configured emotions without creating atoms" do
    assert {:ok, :beer} = Emotion.decode("beer", :article)
  end

  test "unknown persisted emotion is an explicit error" do
    assert {:error, %Error{reason: :unknown_emotion}} = Emotion.decode("release-only", :article)
    assert {:error, %Error{reason: :unknown_emotion}} = Emotion.decode("beer", :unknown)
  end
end
