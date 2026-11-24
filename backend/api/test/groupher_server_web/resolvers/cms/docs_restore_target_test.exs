defmodule GroupherServerWeb.Resolvers.CMS.DocsRestoreTargetTest do
  use ExUnit.Case, async: true

  defmodule PresenceSchema do
    use Absinthe.Schema

    query do
      field :target_presence, :string do
        arg(:target_parent_node_id, :id)

        resolve(fn _, args, _ ->
          {:ok,
           "#{Map.has_key?(args, :target_parent_node_id)}:#{inspect(Map.get(args, :target_parent_node_id))}"}
        end)
      end
    end
  end

  alias GroupherServerWeb.Resolvers.CMS.Docs

  test "omitted target fields restore from the saved location" do
    assert {:ok, :restore_original, nil} = Docs.restore_target_fields(%{})
  end

  test "an explicitly null parent selects the workspace root" do
    assert {:ok, nil, nil} = Docs.restore_target_fields(%{target_parent_node_id: nil})

    assert {:ok, nil, 0} =
             Docs.restore_target_fields(%{target_parent_node_id: nil, target_index: 0})
  end

  test "an explicit parent and optional index are preserved" do
    assert {:ok, "target-parent", nil} =
             Docs.restore_target_fields(%{target_parent_node_id: "target-parent"})

    assert {:ok, "target-parent", 2} =
             Docs.restore_target_fields(%{
               target_parent_node_id: "target-parent",
               target_index: 2
             })
  end

  test "an index without a parent field is rejected" do
    assert {:error, :invalid_tree_input} = Docs.restore_target_fields(%{target_index: 0})
    assert {:error, :invalid_tree_input} = Docs.restore_target_fields(%{target_index: nil})
  end

  test "Absinthe preserves omitted and explicitly null optional arguments" do
    assert {:ok, %{data: %{"targetPresence" => "false:nil"}}} =
             Absinthe.run("{ targetPresence }", PresenceSchema)

    assert {:ok, %{data: %{"targetPresence" => "true:nil"}}} =
             Absinthe.run("{ targetPresence(targetParentNodeId: null) }", PresenceSchema)
  end
end
