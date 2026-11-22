defmodule GroupherServer.CMS.DocTree.Publish.TreeOrderTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.{Plan, TreeOrder}

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

  defp index(nodes, id), do: Enum.find(nodes, &(&1.node_id == id)).index

  test "inserting a Group places it before leaves and shifts only that lane" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)
    leaf = node("leaf", :link, "group", 0, %{href: "/leaf"})
    pin = node("pin", :pin, "tab", 0, %{href: "/pin"})
    nested = node("nested", :group, "group", 0)

    assert {:ok, %{target: target, changed: changed}} =
             TreeOrder.insert([tab, group, leaf, pin], nested, 100)

    assert index(target, "nested") == 0
    assert index(target, "leaf") == 1
    assert index(target, "pin") == 0
    assert Enum.map(changed, & &1.node_id) == ["leaf", "nested"]
    assert {:error, :tree_node_already_exists} = TreeOrder.insert(target, nested, 0)
  end

  test "moving across parents reindexes both lanes without changing pins" do
    nodes = [
      node("tab", :tab, nil, 0),
      node("left", :group, "tab", 0),
      node("right", :group, "tab", 1),
      node("nested", :group, "right", 0),
      node("a", :link, "left", 0, %{href: "/a"}),
      node("b", :link, "left", 1, %{href: "/b"}),
      node("c", :link, "right", 1, %{href: "/c"}),
      node("pin", :pin, "tab", 0, %{href: "/pin"})
    ]

    assert {:ok, %{target: target, changed: changed}} = TreeOrder.move(nodes, "a", "right", 0)
    assert index(target, "b") == 0
    assert index(target, "nested") == 0
    assert index(target, "a") == 1
    assert index(target, "c") == 2
    assert index(target, "pin") == 0
    assert Enum.map(changed, & &1.node_id) == ["a", "b", "c"]
  end

  test "reordering within a lane is stable, including no-op and out-of-range positions" do
    nodes = [
      node("tab", :tab, nil, 0),
      node("g", :group, "tab", 0),
      node("a", :link, "g", 0, %{href: "/a"}),
      node("b", :link, "g", 1, %{href: "/b"})
    ]

    assert {:ok, %{changed: []}} = TreeOrder.move(nodes, "a", "g", 0)
    assert {:ok, %{target: target}} = TreeOrder.move(nodes, "a", "g", 999)
    assert index(target, "a") == 1
    assert index(target, "b") == 0
  end

  test "reindexed sibling changes produce a valid net publish plan" do
    nodes = [
      node("tab", :tab, nil, 0),
      node("g", :group, "tab", 0),
      node("a", :link, "g", 0, %{href: "/a"}),
      node("b", :link, "g", 1, %{href: "/b"})
    ]

    assert {:ok, %{target: target, changed: changed}} = TreeOrder.move(nodes, "a", "g", 1)

    changes =
      Enum.map(changed, fn node ->
        %{node_id: node.node_id, change_type: :upsert, target: Map.delete(node, :node_id)}
      end)

    assert {:ok, %{target: ^target, payload: %{"tree_operations" => operations}}} =
             Plan.build(1, nodes, changes, [], [])

    assert Enum.map(operations, & &1.node_id) == ["a", "b"]
  end

  test "removal reindexes surviving lanes and rejects an incomplete subtree" do
    nodes = [
      node("tab", :tab, nil, 0),
      node("a", :group, "tab", 0),
      node("b", :group, "tab", 1),
      node("child", :link, "a", 0, %{href: "/child"})
    ]

    assert {:error, :invalid_tree_parent} = TreeOrder.remove(nodes, ["a"])
    assert {:ok, %{target: target, changed: [changed]}} = TreeOrder.remove(nodes, ["child", "a"])
    assert changed.node_id == "b"
    assert index(target, "b") == 0
    assert {:error, :invalid_tree_removal} = TreeOrder.remove(nodes, ["a", "a"])
  end

  test "rejects moving a node into its own subtree or an invalid parent" do
    nodes = [node("tab", :tab, nil, 0), node("a", :group, "tab", 0), node("b", :group, "a", 0)]
    assert {:error, :invalid_tree_parent} = TreeOrder.move(nodes, "a", "b", 0)
    assert {:error, :invalid_tree_parent} = TreeOrder.move(nodes, "b", "missing", 0)
  end
end
