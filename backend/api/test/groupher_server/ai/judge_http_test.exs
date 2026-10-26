defmodule GroupherServer.Test.AI.JudgeHTTPTest do
  use ExUnit.Case, async: true

  alias GroupherServer.AI
  alias AI.Adapters.JudgeHTTP
  alias AI.OpinionInput

  test "rejects a complete policy and content that exceed the worker context before HTTP" do
    assert {:ok, input} =
             OpinionInput.new(%{
               system_prompt: "Check content",
               prompt: "Community policy",
               ban_words: [],
               text: %{title: "Title", body: String.duplicate("x", 16_000)},
               images: [],
               required_modalities: [:text]
             })

    assert {:error, %{code: 7508}} =
             JudgeHTTP.check(input, %{
               base_url: "https://review.example.com",
               credential: "unused",
               model: "test"
             })
  end
end
