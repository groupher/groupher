defmodule GroupherServer.CMS.OutboxEventOwnersTest do
  use ExUnit.Case, async: true

  test "each documented event has exactly one concrete Effects payload owner" do
    document = File.read!("../../docs/architecture/command-operation-identity.md")
    [_, inventory] = String.split(document, "<!-- operation-event-owners:start -->")
    [inventory | _] = String.split(inventory, "<!-- operation-event-owners:end -->")

    expected =
      Regex.scan(~r/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/m, inventory)
      |> Map.new(fn [_, event, owner] -> {event, owner} end)

    actual =
      (Path.wildcard("lib/groupher_server/cms/**/*effects*.ex") ++
         Path.wildcard("lib/groupher_server/cms/**/effects/*.ex"))
      |> Enum.uniq()
      |> Enum.flat_map(fn file ->
        source = File.read!(file)
        ast = Code.string_to_quoted!(source)
        {:defmodule, _, [module, _]} = ast
        owner = module |> Macro.to_string() |> String.replace_prefix("GroupherServer.", "")

        {_ast, events} =
          Macro.prewalk(ast, [], fn
            {:def, _, [{:payload_projection, _, _}, _]} = definition, events ->
              {_definition, names} =
                Macro.prewalk(definition, [], fn
                  name, names when is_binary(name) ->
                    if Regex.match?(~r/^[a-z_]+\.[a-z_]+$/, name) do
                      {name, [name | names]}
                    else
                      {name, names}
                    end

                  node, names ->
                    {node, names}
                end)

              {definition, names ++ events}

            node, events ->
              {node, events}
          end)

        Enum.map(Enum.uniq(events), &{&1, owner})
      end)

    produced =
      (Path.wildcard("lib/groupher_server/cms/**/*effects*.ex") ++
         Path.wildcard("lib/groupher_server/cms/**/effects/*.ex"))
      |> Enum.uniq()
      |> Enum.flat_map(fn file ->
        {_ast, names} =
          file
          |> File.read!()
          |> Code.string_to_quoted!()
          |> Macro.prewalk([], fn
            {:event, event} = node, names when is_binary(event) -> {node, [event | names]}
            node, names -> {node, names}
          end)

        names
      end)
      |> Enum.reject(&(&1 == "article.co_author_request"))
      |> MapSet.new()

    # C3 owns Co-author separately. Every producer in this batch must have a contract.
    assert MapSet.subset?(produced, MapSet.new(Map.keys(expected)))

    grouped = Enum.group_by(actual, &elem(&1, 0), &elem(&1, 1))
    assert map_size(expected) > 20
    assert Enum.all?(grouped, fn {_event, owners} -> length(owners) == 1 end)
    assert Map.new(actual) == expected
  end
end
