defmodule GroupherServer.Test.ReviewBot.ConfigModelTest do
  use ExUnit.Case, async: true

  alias GroupherServer.ReviewBot
  alias ReviewBot.Model.ReviewBotConfig

  test "accepts a policy and rejects a community Doc config" do
    attrs = %{
      subject_type: :article,
      community_id: 12,
      review_mode: :human_first,
      ban_words: ["casino", "adult site"],
      prompt: "Consider context.",
      version: 1
    }

    assert ReviewBotConfig.changeset(%ReviewBotConfig{}, attrs).valid?

    refute ReviewBotConfig.changeset(
             %ReviewBotConfig{},
             Map.merge(attrs, %{subject_type: :doc, community_id: 12})
           ).valid?
  end

  test "ban_words are bounded, trimmed and unique" do
    changeset =
      ReviewBotConfig.changeset(%ReviewBotConfig{}, %{
        subject_type: :comment,
        community_id: 12,
        review_mode: :immediate,
        ban_words: [" spam ", "spam"],
        prompt: "",
        version: 1
      })

    assert changeset.valid?
    assert Ecto.Changeset.get_change(changeset, :ban_words) == ["spam"]

    refute ReviewBotConfig.changeset(%ReviewBotConfig{}, %{
             subject_type: :comment,
             community_id: 12,
             review_mode: :immediate,
             ban_words: [String.duplicate("x", 129)],
             prompt: "",
             version: 1
           }).valid?
  end

  test "system policies require a server-side prompt and never have a review mode" do
    attrs = %{
      subject_type: :article,
      review_mode: nil,
      ban_words: ["internal cue"],
      prompt: "Platform-only review instructions.",
      version: 1
    }

    assert ReviewBotConfig.changeset(%ReviewBotConfig{}, attrs).valid?

    refute ReviewBotConfig.changeset(
             %ReviewBotConfig{},
             Map.put(attrs, :review_mode, :immediate)
           ).valid?
  end
end
