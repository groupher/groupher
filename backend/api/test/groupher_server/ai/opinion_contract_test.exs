defmodule GroupherServer.Test.AI.OpinionContractTest do
  use ExUnit.Case, async: true

  alias GroupherServer.AI
  alias AI.{OpinionInput, OpinionOutput}
  alias AI.Adapters.OpenAI

  test "the AI input contains policy and content without CMS identity" do
    assert {:ok, input} =
             OpinionInput.new(%{
               system_prompt: "Check platform policy.",
               prompt: "Check this community's policy.",
               ban_words: ["casino"],
               text: %{title: "Help", body: "How to avoid a casino scam"},
               images: [],
               required_modalities: [:text]
             })

    request = OpenAI.opinion_request_body(input, "test-model") |> Jason.encode!()
    refute request =~ "request_id"
    refute request =~ "content_token"
    refute request =~ "revision_id"
    assert request =~ "casino"
  end

  test "clear requires complete required coverage and no suspicion notes" do
    assert {:ok, input} = opinion_input()

    assert {:ok, %{status: :clear, sus_notes: []}} =
             OpinionOutput.validate(
               %{
                 "status" => "clear",
                 "susNotes" => [],
                 "coverage" => %{"text" => "complete", "image" => "complete"},
                 "summary" => "No issue found."
               },
               input
             )

    assert {:error, :provider_protocol_error} =
             OpinionOutput.validate(
               %{
                 "status" => "clear",
                 "susNotes" => [],
                 "coverage" => %{"text" => "failed", "image" => "complete"},
                 "summary" => "No issue found."
               },
               input
             )
  end

  test "suspect requires a bounded, typed evidence note" do
    assert {:ok, input} = opinion_input()

    assert {:ok, %{status: :suspect, sus_notes: [%{type: "spam"}]}} =
             OpinionOutput.validate(
               %{
                 "status" => "suspect",
                 "susNotes" => [
                   %{
                     "type" => "spam",
                     "evidence" => "shortened link",
                     "explanation" => "The link redirects to a sales page."
                   }
                 ],
                 "coverage" => %{"text" => "complete", "image" => "complete"},
                 "summary" => "Promotional link."
               },
               input
             )

    assert {:error, :provider_protocol_error} =
             OpinionOutput.validate(
               %{
                 "status" => "suspect",
                 "susNotes" => [],
                 "coverage" => %{"text" => "complete", "image" => "complete"},
                 "summary" => "Promotional link."
               },
               input
             )
  end

  defp opinion_input do
    OpinionInput.new(%{
      system_prompt: "System prompt.",
      prompt: "",
      ban_words: [],
      text: %{title: "Title", body: "Body"},
      images: [],
      required_modalities: [:text]
    })
  end
end
