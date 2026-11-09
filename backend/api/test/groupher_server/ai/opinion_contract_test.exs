defmodule GroupherServer.Test.AI.OpinionContractTest do
  use ExUnit.Case, async: true

  alias GroupherServer.AI
  alias AI.{Const, OpinionInput, OpinionOutput}
  alias AI.Adapters.JudgeHTTP

  test "Phoenix validator vocabularies match the shared Review AI contract" do
    contract_path =
      Path.expand("../../../../../packages/contracts/review-ai.contract.json", __DIR__)

    contract = contract_path |> File.read!() |> Jason.decode!()
    request = contract["definitions"]["request"]
    request_properties = request["properties"]
    response = contract["definitions"]["response"]
    response_properties = response["properties"]

    assert Enum.sort(Map.keys(request_properties)) ==
             Enum.sort(~w(model systemPrompt prompt banWords text images requiredModalities))

    assert request["required"] |> Enum.sort() == Enum.sort(Map.keys(request_properties))
    assert request_properties["text"]["required"] == ["title", "body"]
    assert request_properties["images"]["maxItems"] == 10
    assert request_properties["banWords"]["maxItems"] == 10_000

    assert Enum.sort(response_properties["status"]["enum"]) ==
             Const.statuses() |> Enum.map(&Atom.to_string/1) |> Enum.sort()

    assert Enum.sort(response_properties["coverage"]["properties"]["text"]["enum"]) ==
             Const.coverages() |> Enum.map(&Atom.to_string/1) |> Enum.sort()

    assert Enum.sort(response_properties["susNotes"]["items"]["properties"]["type"]["enum"]) ==
             Enum.sort(Const.note_types())

    assert response_properties["susNotes"]["maxItems"] == 20

    assert response_properties["susNotes"]["items"]["properties"]["evidence"]["maxLength"] ==
             500

    assert response_properties["susNotes"]["items"]["properties"]["explanation"]["maxLength"] ==
             1_000

    assert response_properties["summary"]["maxLength"] == 2_000

    assert {:ok, input} = opinion_input()
    body = JudgeHTTP.opinion_request_body(input, "test-model")
    assert Enum.sort(Map.keys(body)) == Enum.sort(Map.keys(request_properties))

    assert Enum.sort(Map.keys(body["text"])) ==
             Enum.sort(Map.keys(request_properties["text"]["properties"]))
  end

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

    request = JudgeHTTP.opinion_request_body(input, "test-model") |> Jason.encode!()
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
