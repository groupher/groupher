defmodule GroupherServer.TestWeb.Schema.ReviewBotContractTest do
  use ExUnit.Case, async: true

  alias GroupherServer
  alias GroupherServer.ReviewBot
  alias ReviewBot.Authorization
  alias GroupherServerWeb.Resolvers.ReviewBot, as: ReviewBotResolver
  alias GroupherServerWeb.Schema

  test "the client config contract exposes only community policy fields" do
    fields = Schema.__absinthe_type__(:review_bot_config).fields

    assert Map.has_key?(fields, :review_mode)
    assert Map.has_key?(fields, :review_ban_words)
    assert Map.has_key?(fields, :review_prompt)
    refute Map.has_key?(fields, :ban_words)
    refute Map.has_key?(fields, :prompt)
    refute Map.has_key?(fields, :system_review_ban_words)
    refute Map.has_key?(fields, :system_review_prompt)
  end

  test "platform config reads are rejected without revealing system policy" do
    assert {:error, _reason} =
             ReviewBotResolver.review_bot_config(
               nil,
               %{scope: %{type: :platform}, subject_type: :article},
               %{context: %{}}
             )

    assert {:error, _reason} =
             ReviewBotResolver.update_review_bot_config(
               nil,
               %{
                 input: %{
                   scope: %{type: :platform},
                   subject_type: :article,
                   expected_version: 1,
                   review_mode: :immediate,
                   review_ban_words: [],
                   review_prompt: ""
                 },
                 command_id: Ecto.UUID.generate()
               },
               %{context: %{}}
             )

    assert {:error, _reason} = Authorization.authorize(%{type: :platform}, :read, %{})
  end
end
