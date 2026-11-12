defmodule GroupherServer.CMS.DocTree.Publish.TreeOperationsTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.TreeOperations

  defp node(id, type, parent, index, attrs \\ %{}) do
    Map.merge(
      %{
        node_id: id,
        type: type,
        parent_node_id: parent,
        index: index,
        title: id,
        href: nil,
        doc_id: nil,
        marker: nil,
        badge: nil,
        hidden: false
      },
      attrs
    )
  end

  defp upsert(node) do
    %{node_id: node.node_id, change_kind: :upsert, target: Map.delete(node, :node_id)}
  end

  defp delete(id), do: %{node_id: id, change_kind: :delete, target: nil}
  defp ids(ops), do: Enum.map(ops, &{&1.action, &1.node_id})

  test "creates parents first, sorts available nodes, and is input-order independent" do
    tab = node("z-tab", :tab, nil, 0)
    group = node("a-group", :group, "z-tab", 0)
    link = node("b-link", :link, "a-group", 0, %{href: "/doc"})
    pin = node("c-pin", :pin, "z-tab", 0, %{href: "/pin"})
    changes = Enum.map([link, pin, group, tab], &upsert/1)

    assert {:ok, result} = TreeOperations.plan([], changes)

    assert ids(result.operations) == [
             create: "z-tab",
             create: "a-group",
             create: "b-link",
             create: "c-pin"
           ]

    assert {:ok, ^result} = TreeOperations.plan([], Enum.reverse(changes))
  end

  test "moves children out before deleting parents and deletes leaves before ancestors" do
    tab = node("tab", :tab, nil, 0)
    old = node("a-old", :group, "tab", 0)
    new = node("b-new", :group, "tab", 1)
    link = node("c-link", :link, "a-old", 0, %{href: "/doc"})
    moved = %{link | parent_node_id: "b-new"}
    changes = [delete("a-old"), upsert(%{new | index: 0}), upsert(moved)]

    assert {:ok, result} = TreeOperations.plan([tab, old, new, link], changes)
    operations = ids(result.operations)

    assert Enum.find_index(operations, &(&1 == {:update, "c-link"})) <
             Enum.find_index(operations, &(&1 == {:delete, "a-old"}))

    assert {:ok, deletion} =
             TreeOperations.plan([tab, old, link], [
               delete("tab"),
               delete("a-old"),
               delete("c-link")
             ])

    assert ids(deletion.operations) == [delete: "c-link", delete: "a-old", delete: "tab"]
  end

  test "orders parent-child inversion without creating an intermediate cycle" do
    tab = node("tab", :tab, nil, 0)
    a = node("a", :group, "tab", 0)
    b = node("b", :group, "a", 0)

    assert {:ok, result} =
             TreeOperations.plan([tab, a, b], [
               upsert(%{a | parent_node_id: "b"}),
               upsert(%{b | parent_node_id: "tab"})
             ])

    assert ids(result.operations) == [update: "b", update: "a"]
  end

  test "omits no-op members and rejects node type replacement" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)
    assert {:ok, %{operations: []}} = TreeOperations.plan([group, tab], [upsert(group)])

    replacement = node("group", :pin, "tab", 0, %{href: "/pin"})

    assert {:error, :tree_node_type_changed} =
             TreeOperations.plan([tab, group], [upsert(replacement)])
  end
end
