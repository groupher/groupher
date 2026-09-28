defmodule GroupherServer.RequestActorTest do
  use GroupherServer.DataCase, async: true

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ViewTracker.AnonymousSession
  alias GroupherServer.RequestActor
  alias GroupherServer.RequestActor.{Classification, Crawler, Evidence}

  test "classifies a complete verified delegation" do
    assert {:ok,
            %Classification{
              type: :agent,
              is_authenticated: true,
              confidence: :verified,
              classified_by: :delegation_credential
            }} =
             RequestActor.classify(
               delegation: %{service_actor: service_credential(), user_actor: %User{id: 1}}
             )
  end

  test "classifies a signed anonymous session as probable human" do
    assert {:ok,
            %Classification{
              type: :human,
              is_authenticated: false,
              confidence: :probable,
              classified_by: :signed_anonymous_session
            }} =
             RequestActor.classify(anonymous_session: %AnonymousSession{id: "anonymous-1"})
  end

  test "self-reported automation takes precedence over a signed anonymous session" do
    assert {:ok,
            %Classification{
              type: :unknown,
              is_authenticated: false,
              confidence: :probable,
              classified_by: :self_reported
            }} =
             RequestActor.classify(
               anonymous_session: %AnonymousSession{id: "anonymous-1"},
               user_agent: "ExampleBot/1.0"
             )
  end

  test "ordinary browser User-Agent remains a probable anonymous human" do
    assert {:ok,
            %Classification{
              type: :human,
              confidence: :probable,
              classified_by: :signed_anonymous_session
            }} =
             RequestActor.classify(
               anonymous_session: %AnonymousSession{id: "anonymous-1"},
               user_agent:
                 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36"
             )
  end

  test "classifies verified service and crawler business objects" do
    assert {:ok, %Classification{type: :agent, classified_by: :agent_credential}} =
             RequestActor.classify(service_credential: service_credential())

    assert {:ok, %Classification{type: :crawler, classified_by: :verified_crawler}} =
             RequestActor.classify(crawler: %Crawler{family: "googlebot"})
  end

  test "classifies account session once without caller-selected output fields" do
    assert {:ok,
            %Classification{
              type: :human,
              is_authenticated: true,
              confidence: :verified,
              classified_by: :account_session
            }} =
             RequestActor.classify(
               account_session: %User{id: 1},
               actor_type: :crawler,
               confidence: :unknown,
               classified_by: :fallback
             )
  end

  test "bare credential identifiers cannot construct a verified actor" do
    assert {:ok,
            %Classification{
              type: :unknown,
              confidence: :unknown,
              classified_by: :fallback
            }} =
             RequestActor.classify(
               agent_credential_id: "agent-1",
               delegation_id: "delegation-1",
               crawler_family: "googlebot"
             )
  end

  test "User-Agent self report remains unknown and probable" do
    assert {:ok,
            %Classification{
              type: :unknown,
              is_authenticated: false,
              confidence: :probable,
              classified_by: :self_reported
            }} = RequestActor.classify(user_agent: "ExampleBot/1.0")
  end

  test "falls back to unknown when no trusted evidence is present" do
    assert {:ok,
            %Classification{
              type: :unknown,
              is_authenticated: false,
              confidence: :unknown,
              classified_by: :fallback
            }} = RequestActor.classify([])
  end

  test "fails closed when trusted inputs conflict" do
    assert {:error, :conflicting_evidence} =
             RequestActor.classify(
               account_session: %User{id: 1},
               anonymous_session: %AnonymousSession{id: "anonymous-1"}
             )

    assert {:error, :conflicting_evidence} =
             RequestActor.classify(
               service_credential: service_credential(),
               crawler: %Crawler{family: "googlebot"}
             )
  end

  test "rejects invalid trusted objects and public Evidence injection" do
    assert {:error, :invalid_evidence} =
             RequestActor.classify(service_credential: %{subject: "service:broken"})

    assert {:ok, %Classification{type: :unknown}} =
             RequestActor.classify(evidence: %Evidence.Unknown{classified_by: :fallback})
  end

  defp service_credential do
    %{
      audience: "phoenix:view-api",
      scopes: MapSet.new(["view:track"]),
      subject: "service:test",
      token_id: "credential-1"
    }
  end
end
