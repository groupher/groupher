# Run with: node scripts/graphql-complexity-fixtures.mjs | (cd backend/api && mix run --no-start test/graphql_complexity/check.exs)
queries = IO.read(:stdio, :eof) |> Jason.decode!()
limit = GroupherServerWeb.GraphQLLimits.max_complexity()

results =
  Enum.map(queries, fn %{
                         "name" => name,
                         "source" => source,
                         "query" => query,
                         "variables" => vars
                       } ->
    options = [variables: vars, analyze_complexity: true, max_complexity: limit]

    pipeline =
      Absinthe.Pipeline.for_document(GroupherServerWeb.Schema, options)
      |> Absinthe.Pipeline.upto(Absinthe.Phase.Document.Complexity.Result)
      |> Kernel.++([{GroupherServerWeb.GraphQLCost, options}])
      |> Kernel.++([Absinthe.Phase.Document.Result])

    case Absinthe.Pipeline.run(query, pipeline) do
      {:ok, %{operations: [%{complexity: complexity}], result: result}, _}
      when is_integer(complexity) ->
        case result do
          %{errors: errors} when errors != [] -> {:error, source, name, errors}
          _ -> {:ok, source, name, complexity}
        end

      {:ok, %{result: result}, _} ->
        {:error, source, name, result}

      result ->
        {:error, source, name, inspect(result, limit: 6)}
    end
  end)

errors = Enum.filter(results, &(elem(&1, 0) == :error))

if errors != [] do
  Mix.raise(
    "Complexity checks failed:\n#{inspect(errors, limit: :infinity, printable_limit: :infinity, pretty: true)}"
  )
end

if length(results) == 0 or not Enum.any?(results, &(elem(&1, 1) == "graphiql-6")) do
  Mix.raise("Expected repository operations and GraphiQL introspection")
end

results
|> Enum.sort_by(&elem(&1, 3), :desc)
|> Enum.take(5)
|> IO.inspect(
  label: "Highest Absinthe operation complexities (limit #{limit}; #{length(results)} checked)"
)
