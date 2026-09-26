defmodule GroupherServer.RequestActorTest do
  use GroupherServer.DataCase, async: true

  alias GroupherServer.RequestActor
  alias GroupherServer.RequestActor.Classification

  test "prefers a verified delegation over account and anonymous signals" do
    assert {:ok,
            %Classification{
              type: :agent,
              is_authenticated: true,
              confidence: :verified,
              classified_by: :delegation_credential
            }} =
             RequestActor.classify(
               user: %{id: 1},
               delegation_id: "delegation-1",
               anonymous_id: "anonymous-1"
             )
  end

  test "classifies a signed anonymous session as probable human" do
    assert {:ok,
            %Classification{
              type: :human,
              is_authenticated: false,
              confidence: :probable,
              classified_by: :signed_anonymous_session
            }} = RequestActor.classify(anonymous_id: "anonymous-1")
  end

  test "classifies verified crawler signals without accepting actor_type input" do
    assert {:ok,
            %Classification{
              type: :crawler,
              is_authenticated: false,
              confidence: :verified,
              classified_by: :verified_crawler
            }} = RequestActor.classify(actor_type: :human, crawler_family: "googlebot")
  end

  test "falls back to unknown when no trusted signal is present" do
    assert {:ok,
            %Classification{
              type: :unknown,
              is_authenticated: false,
              confidence: :unknown,
              classified_by: :fallback
            }} = RequestActor.classify([])
  end

  test "fails closed when agent credentials conflict" do
    assert {:error, :conflicting_signals} =
             RequestActor.classify(
               delegation_id: "delegation-1",
               agent_credential_id: "agent-1"
             )
  end

  test "fails closed when crawler identity conflicts with a session" do
    assert {:error, :conflicting_signals} =
             RequestActor.classify(crawler_family: "googlebot", anonymous_id: "anonymous-1")
  end

  test "fails closed when crawler identity conflicts with either agent signal" do
    assert {:error, :conflicting_signals} =
             RequestActor.classify(
               crawler_family: "googlebot",
               delegation_id: "delegation-1"
             )

    assert {:error, :conflicting_signals} =
             RequestActor.classify(
               crawler_family: "googlebot",
               agent_credential_id: "agent-1"
             )
  end
end
