defmodule GroupherServer.Test.CMS.Passport.CatalogParityTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.GateAction

  test "generated Article threads match runtime and GraphQL enums" do
    runtime = CMS.Artiment.Config.threads() |> Enum.map(&to_string/1) |> Enum.sort()
    assert Enum.sort(GateAction.threads()) == runtime

    schema = File.read!(Path.expand("schema.graphql", File.cwd!()))
    [_, values] = Regex.run(~r/enum ArticleThread\s*\{([^}]*)\}/, schema)

    graphql =
      values
      |> String.split(~r/\s+/, trim: true)
      |> Enum.map(&String.downcase/1)
      |> Enum.sort()

    assert graphql == runtime
  end

  test "GraphQL PassportAction enum exactly matches the canonical Action contract" do
    enum = Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :passport_action)
    assert %Absinthe.Type.Enum{} = enum

    graphql_values = enum.values |> Map.values() |> Enum.map(& &1.value) |> Enum.sort()
    assert graphql_values == Enum.sort(GateAction.all())
  end
end
