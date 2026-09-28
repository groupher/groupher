defmodule GroupherServerWeb.ContextRequestActorTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias GroupherServer.CMS.ViewTracker.AnonymousSession
  alias GroupherServer.RequestActor.Classification
  alias GroupherServerWeb.Context

  test "classifies the signed anonymous session once at the request boundary" do
    context = :get |> conn("/graphiql") |> Context.call([]) |> request_context()

    assert %AnonymousSession{id: id} = context.anonymous_session
    assert is_binary(id)

    assert %Classification{
             type: :human,
             is_authenticated: false,
             confidence: :probable,
             classified_by: :signed_anonymous_session
           } = context.request_actor
  end

  test "does not let the automatic anonymous session hide a self-reported crawler" do
    context =
      :get
      |> conn("/graphiql")
      |> put_req_header("user-agent", "ExampleBot/1.0")
      |> Context.call([])
      |> request_context()

    assert %AnonymousSession{} = context.anonymous_session

    assert %Classification{
             type: :unknown,
             is_authenticated: false,
             confidence: :probable,
             classified_by: :self_reported
           } = context.request_actor
  end

  test "keeps an ordinary anonymous browser classified as probable human" do
    context =
      :get
      |> conn("/graphiql")
      |> put_req_header(
        "user-agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36"
      )
      |> Context.call([])
      |> request_context()

    assert %Classification{
             type: :human,
             confidence: :probable,
             classified_by: :signed_anonymous_session
           } = context.request_actor
  end

  test "keeps the complete verified service object beside its shared classification" do
    context =
      :post
      |> conn("/graphiql")
      |> put_req_header("x-groupher-test-service-auth", "enabled")
      |> Context.call([])
      |> request_context()

    assert context.service_actor.subject == "service:test-suite"

    assert %Classification{
             type: :agent,
             is_authenticated: false,
             confidence: :verified,
             classified_by: :agent_credential
           } = context.request_actor
  end

  defp request_context(conn), do: conn.private.absinthe.context
end
