defmodule MentionsPerf.HTTP do
  @moduledoc """
  Sends real anonymous GraphQL reads through the Phoenix HTTP handler.

      JSON request -> Endpoint -> GraphQL -> domain result or typed revision rejection
  """
  alias GroupherServer.CMS

  def graph(document, variables) do
    conn =
      Plug.Test.conn(:post, "/graphql", Jason.encode!(%{query: document, variables: variables}))
      |> Plug.Conn.put_req_header("content-type", "application/json")
      |> GroupherServerWeb.Endpoint.call([])

    payload = Jason.decode!(conn.resp_body)

    case {conn.status, payload} do
      {200, %{"errors" => errors}} ->
        if errors != [] and
             Enum.all?(errors, &(get_in(&1, ["extensions", "code"]) in [4553, "4553"])) do
          {:error, CMS.ErrorCat.mentions_graph_invalid_request()}
        else
          {:error, {:graphql_errors, Enum.map(errors, & &1["extensions"])}}
        end

      {200, %{"data" => %{"mentionsGraph" => graph}}} ->
        {:ok, graph}

      {status, _} ->
        {:error, {:http_status, status}}
    end
  end
end
