defmodule GroupherServerWeb.GraphQLEndpointTest do
  use GroupherServerWeb.ConnCase, async: true

  test "executes GraphQL on the API endpoint and disables caching", %{conn: conn} do
    conn = post(conn, "/graphql", %{query: "{ __typename }"})
    assert json_response(conn, 200) == %{"data" => %{"__typename" => "RootQueryType"}}
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "does not execute operations on the IDE endpoint", %{conn: conn} do
    conn = post(conn, "/graphiql", %{query: "{ __typename }"})
    assert conn.status == 404
  end

  test "routes the GraphiQL page separately from the API" do
    assert %{plug: GroupherServerWeb.Controller.GraphiQL, plug_opts: :show} =
             Phoenix.Router.route_info(GroupherServerWeb.Router, "GET", "/graphiql", "localhost")
  end

  test "executes the GraphiQL 6 schema query within the configured limit", %{conn: conn} do
    query = File.read!("test/fixtures/graphiql_introspection.graphql")
    response = conn |> post("/graphql", %{query: query}) |> json_response(200)
    assert [_ | _] = get_in(response, ["data", "__schema", "types"])
    refute Map.has_key?(response, "errors")
  end

  test "rejects lookalike CORS origins", %{conn: conn} do
    conn =
      conn
      |> put_req_header("origin", "https://evilgroupher.com")
      |> post("/graphql", %{query: "{ __typename }"})

    assert get_resp_header(conn, "access-control-allow-origin") == []
  end

  test "rejects excessively large GraphQL documents before execution", %{conn: conn} do
    query = "query { " <> String.duplicate("__typename ", 20_001) <> "}"
    conn = post(conn, "/graphql", %{query: query})

    assert %{"errors" => [%{"message" => "Token limit exceeded"} | _]} =
             json_response(conn, 200)
  end

  test "rejects excessive field complexity before execution", %{conn: conn} do
    fields = Enum.map_join(1..251, " ", &"field#{&1}: me { login }")
    conn = post(conn, "/graphql", %{query: "query { " <> fields <> " }"})

    assert %{"errors" => [%{"message" => message} | _]} = json_response(conn, 200)
    assert message =~ "too complex"
  end

  test "accepts complexity at the limit and rejects the next field", %{conn: conn} do
    fields = Enum.map_join(1..250, " ", &"field#{&1}: me { login }")

    response =
      conn |> post("/graphql", %{query: "query { " <> fields <> " }"}) |> json_response(200)

    refute Enum.any?(response["errors"] || [], &String.contains?(&1["message"], "too complex"))

    response =
      build_conn()
      |> post("/graphql", %{query: "query { " <> fields <> " another: me { __typename } }"})
      |> json_response(200)

    assert Enum.any?(response["errors"], &String.contains?(&1["message"], "complexity is 501"))
  end

  test "charges nested page sizes before resolving the operation", %{conn: conn} do
    fields = Enum.map_join(1..55, " ", &"action#{&1}: action")

    query = """
    query NestedPages($pagi: PagiInput!) {
      ticketKanban(community: "home", pagi: $pagi) {
        todo { entries { activity(pagi: $pagi) { entries { #{fields} } } } }
      }
    }
    """

    response =
      conn
      |> post("/graphql", %{query: query, variables: %{pagi: %{offset: %{page: 1, size: 100}}}})
      |> json_response(200)

    assert Enum.any?(response["errors"], &String.contains?(&1["message"], "page-aware cost"))

    small =
      build_conn()
      |> post("/graphql", %{query: query, variables: %{pagi: %{offset: %{page: 1, size: 1}}}})
      |> json_response(200)

    refute Enum.any?(small["errors"] || [], &String.contains?(&1["message"], "page-aware cost"))

    skipped_query =
      String.replace(query, "pagi: $pagi) {", "pagi: $pagi) @skip(if: true) {", global: false)

    skipped =
      build_conn()
      |> post("/graphql", %{
        query: skipped_query,
        variables: %{pagi: %{offset: %{page: 1, size: 100}}}
      })
      |> json_response(200)

    assert skipped["data"] == %{}
    refute Map.has_key?(skipped, "errors")
  end

  test "handles repeated fragment trees without expanding them exponentially" do
    fragments =
      Enum.map_join(1..35, "\n", fn index ->
        "fragment F#{index} on RootQueryType { ...F#{index - 1} ...F#{index - 1} }"
      end)

    query = "query { ...F35 }\nfragment F0 on RootQueryType { __typename }\n" <> fragments
    options = [analyze_complexity: true, max_complexity: 500]

    pipeline =
      Absinthe.Pipeline.for_document(GroupherServerWeb.Schema, options)
      |> Absinthe.Pipeline.upto(Absinthe.Phase.Document.Complexity.Result)
      |> Kernel.++([{GroupherServerWeb.GraphQLCost, options}])
      |> Kernel.++([Absinthe.Phase.Document.Result])

    assert {:ok, %{result: %{errors: [%{message: message} | _]}}, _} =
             Absinthe.Pipeline.run(query, pipeline)

    assert message =~ "page-aware cost"
  end

  test "reuses an anonymous viewer cookie across GraphQL requests", %{conn: conn} do
    first = post(conn, "/graphql", %{query: "{ __typename }"})
    token = first.resp_cookies["groupher-viewer"].value

    second =
      build_conn()
      |> put_req_cookie("groupher-viewer", token)
      |> post("/graphql", %{query: "{ __typename }"})

    assert json_response(second, 200)["data"]["__typename"] == "RootQueryType"
    refute Map.has_key?(second.resp_cookies, "groupher-viewer")
  end

  test "rejects cookie mutation in a JSON batch without CSRF proof", %{conn: conn} do
    payload = Jason.encode!([%{query: "mutation { __typename }"}])

    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> put_req_header("content-type", "application/json")
      |> post("/graphql", payload)

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end

  test "accepts cookie mutation in a batch with CSRF proof", %{conn: conn} do
    payload = Jason.encode!([%{query: "mutation { __typename }"}])

    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> put_req_header("content-type", "application/json")
      |> put_req_header("origin", "https://api.groupher.com")
      |> put_req_header("x-groupher-csrf", "1")
      |> post("/graphql", payload)

    assert length(json_response(conn, 200)) == 1
  end

  test "rejects cookie mutation supplied as a raw GraphQL body", %{conn: conn} do
    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> put_req_header("content-type", "application/graphql")
      |> post("/graphql", "mutation { __typename }")

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end

  test "rejects misleading JSON content types for cookie requests", %{conn: conn} do
    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> put_req_header("content-type", "application/json-malicious")
      |> post("/graphql", "mutation { __typename }")

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end

  test "rejects cookie mutation supplied in URL parameters without CSRF proof", %{conn: conn} do
    query = URI.encode_www_form("mutation { __typename }")

    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> post("/graphql?query=" <> query, %{})

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end

  test "rejects cookie mutation in encoded batch operations without CSRF proof", %{conn: conn} do
    operations = Jason.encode!([%{query: "mutation { __typename }"}])

    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> post("/graphql", %{"operations" => operations})

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end

  test "accepts a bounded batch and rejects oversized batches", %{conn: conn} do
    payload = Jason.encode!(List.duplicate(%{query: "{ __typename }"}, 10))

    accepted =
      conn |> put_req_header("content-type", "application/json") |> post("/graphql", payload)

    assert length(json_response(accepted, 200)) == 10

    oversized = Jason.encode!(List.duplicate(%{query: "{ __typename }"}, 11))

    rejected =
      build_conn()
      |> put_req_header("content-type", "application/json")
      |> post("/graphql", oversized)

    assert %{"errors" => [%{"message" => "GraphQL batch limit exceeded"}]} =
             json_response(rejected, 413)
  end

  test "requires CSRF proof for cookie-authenticated mutations", %{conn: conn} do
    conn =
      conn
      |> put_req_cookie("groupher-auth.token", "invalid")
      |> post("/graphql", %{query: "mutation { __typename }"})

    assert %{"errors" => [%{"extensions" => %{"code" => "INVALID_CSRF"}}]} =
             json_response(conn, 400)
  end
end
