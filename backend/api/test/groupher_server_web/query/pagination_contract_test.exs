defmodule GroupherServerWeb.Query.PaginationContractTest do
  use ExUnit.Case, async: true

  alias GroupherServerWeb.Schema
  alias GroupherServerWeb.GraphQL.OneOfValidation

  test "OneOf rejects a value alongside an explicit null in literals and variables" do
    for input <- ["{offset: {}, cursor: null}", "{offset: null, cursor: {}}"] do
      query = "{ __typename postPage(pagi: #{input}) @skip(if: true) { __typename } }"
      assert {:ok, %{errors: [%{message: message} | _]}} = run_validated(query)
      assert message =~ "exactly one non-null field"
    end

    query = """
    query PaginationValidation($pagi: PagiInput) {
      __typename
      postPage(pagi: $pagi) @skip(if: true) { __typename }
    }
    """

    for input <- [%{"offset" => %{}, "cursor" => nil}, %{"offset" => nil, "cursor" => %{}}] do
      assert {:ok, %{errors: [%{message: message} | _]}} =
               run_validated(query, variables: %{"pagi" => input})

      assert message =~ "exactly one non-null field"
    end
  end

  test "GraphQL HTTP pipeline rejects an explicit null beside a value" do
    query =
      "{ __typename postPage(pagi: {offset: {}, cursor: null}) @skip(if: true) { __typename } }"

    options =
      Absinthe.Plug.GraphiQL.init(
        schema: Schema,
        pipeline: {OneOfValidation, :plug_pipeline}
      )

    conn =
      :post
      |> Plug.Test.conn("/", %{"query" => query})
      |> Absinthe.Plug.GraphiQL.call(options)

    assert %{"errors" => [%{"message" => message} | _]} = Jason.decode!(conn.resp_body)
    assert message =~ "exactly one non-null field"
  end

  defp run_validated(query, options \\ []) do
    Absinthe.run(
      query,
      Schema,
      Keyword.put(options, :pipeline_modifier, &OneOfValidation.pipeline/2)
    )
  end

  test "operation descriptions remain executable" do
    assert {:ok, %{data: %{"__typename" => "RootQueryType"}}} =
             Absinthe.run(
               """
               "Identifies the GraphQL root without loading application data."
               query DescribeRoot { __typename }
               """,
               Schema
             )
  end

  test "PagiInput validates inline values and variables before resolving fields" do
    for input <- ["{offset: {page: 1}}", "{cursor: {first: 10}}"] do
      query = "{ __typename postPage(pagi: #{input}) @skip(if: true) { __typename } }"
      assert {:ok, %{data: %{"__typename" => _}}} = run_validated(query)
    end

    for input <- ["{}", "{offset: {}, cursor: {}}", "{offset: null}"] do
      query = "{ __typename postPage(pagi: #{input}) @skip(if: true) { __typename } }"
      assert {:ok, %{errors: [_ | _]}} = run_validated(query)
    end

    query = """
    query PaginationValidation($pagi: PagiInput) {
      __typename
      postPage(pagi: $pagi) @skip(if: true) { __typename }
    }
    """

    for input <- [%{"offset" => %{"page" => 1}}, %{"cursor" => %{"first" => 10}}] do
      assert {:ok, %{data: %{"__typename" => _}}} =
               run_validated(query, variables: %{"pagi" => input})
    end

    for input <- [%{}, %{"offset" => %{}, "cursor" => %{}}, %{"offset" => nil}] do
      assert {:ok, %{errors: [_ | _]}} =
               run_validated(query, variables: %{"pagi" => input})
    end
  end

  test "PagiInput is a standard GraphQL oneOf input" do
    assert {:ok, %{data: %{"__type" => type}}} =
             Absinthe.run(
               """
               {
                 __type(name: "PagiInput") {
                   name
                   kind
                   isOneOf
                   inputFields { name }
                 }
               }
               """,
               Schema
             )

    assert type["name"] == "PagiInput"
    assert type["kind"] == "INPUT_OBJECT"
    assert type["isOneOf"] == true
    assert Enum.sort(Enum.map(type["inputFields"], & &1["name"])) == ["cursor", "offset"]
  end

  test "page info and resource page types expose the frozen shape" do
    assert {:ok, %{data: %{"__type" => page_info}}} =
             Absinthe.run(
               """
               {
                 __type(name: "PageInfo") {
                   kind
                   fields { name }
                   possibleTypes { name }
                 }
               }
               """,
               Schema
             )

    assert page_info["kind"] == "INTERFACE"

    assert Enum.sort(Enum.map(page_info["fields"], & &1["name"])) == [
             "hasNextPage",
             "hasPreviousPage"
           ]

    assert Enum.sort(Enum.map(page_info["possibleTypes"], & &1["name"])) == [
             "CursorPageInfo",
             "OffsetPageInfo"
           ]

    assert {:ok, %{data: %{"__type" => post_page}}} =
             Absinthe.run(
               """
               {
                 __type(name: "PostPage") {
                   fields { name }
                 }
               }
               """,
               Schema
             )

    assert Enum.sort(Enum.map(post_page["fields"], & &1["name"])) == [
             "entries",
             "pageInfo",
             "pinnedEntries"
           ]
  end

  test "new Article page fields use the PagiInput pipeline" do
    assert {:ok, %{data: %{"__schema" => schema}}} =
             Absinthe.run(
               """
               {
                 __schema {
                   queryType {
                     fields {
                       name
                       args { name type { kind name ofType { kind name } } }
                     }
                   }
                 }
               }
               """,
               Schema
             )

    query_fields = Map.new(schema["queryType"]["fields"], &{&1["name"], &1["args"]})

    for field <- ["postPage", "changelogPage", "commentPage"] do
      args = Map.new(query_fields[field], &{&1["name"], &1["type"]})
      assert Map.has_key?(args, "pagi")
      assert args["pagi"]["name"] == "PagiInput"
      refute Map.has_key?(args, "filter") and args["filter"]["name"] =~ "Paged"
    end
  end

  test "removed Article list fields are absent instead of deprecated" do
    assert {:ok, %{data: %{"__schema" => schema}}} =
             Absinthe.run(
               """
               {
                 __schema {
                   queryType {
                     fields(includeDeprecated: true) {
                       name
                       isDeprecated
                       deprecationReason
                     }
                   }
                 }
               }
               """,
               Schema
             )

    fields = Map.new(schema["queryType"]["fields"], &{&1["name"], &1})

    for field <- ["pagedPosts", "pagedChangelogs", "pagedBlogs", "pagedDocs"] do
      refute Map.has_key?(fields, field)
    end
  end
end
