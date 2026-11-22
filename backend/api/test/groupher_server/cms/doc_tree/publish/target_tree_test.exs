defmodule GroupherServer.CMS.DocTree.Publish.TargetTreeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.TargetTree

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
    %{node_id: node.node_id, change_type: :upsert, target: Map.delete(node, :node_id)}
  end

  test "overlays complete changes deterministically and preserves fields and independent pin order" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)
    pin = node("pin", :pin, "tab", 0, %{href: "/doc", badge: "new", hidden: true})
    link = node("link", :link, "group", 0, %{href: "https://example.test"})
    page = node("page", :page, "group", 1, %{doc_id: Ecto.UUID.generate(), marker: %{"x" => 1}})

    assert {:ok, target} =
             TargetTree.build([group, tab], [upsert(page), upsert(pin), upsert(link)])

    assert Enum.map(target, & &1.node_id) == ["group", "link", "page", "pin", "tab"]
    assert Enum.find(target, &(&1.node_id == "pin")) == pin

    assert {:ok, ^target} =
             TargetTree.build([tab, group], [upsert(link), upsert(pin), upsert(page)])
  end

  test "rejects orphan, invalid parent type, cycles and removal of a needed parent" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)
    link = node("link", :link, "group", 0, %{href: "/foo"})

    assert {:error, :invalid_tree_parent} =
             TargetTree.build([tab, group, link], [
               %{node_id: "group", change_type: :delete, target: nil}
             ])

    assert {:error, :invalid_tree_parent} =
             TargetTree.build([tab], [upsert(%{link | parent_node_id: "tab"})])

    a = node("a", :group, "b", 0)
    b = node("b", :group, "a", 0)
    assert {:error, :invalid_tree_parent} = TargetTree.build([], [upsert(a), upsert(b)])
  end

  test "accepts web and relative navigation links and rejects unsafe or malformed hrefs" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)

    for type <- [:link, :pin],
        href <- [
          "https://example.test/a",
          "http://example.test",
          "/docs/1",
          "guide/page",
          "#section",
          "?page=2"
        ] do
      parent = if type == :pin, do: "tab", else: "group"
      item = node("item", type, parent, 0, %{href: href})
      assert {:ok, _} = TargetTree.build([tab, group], [upsert(item)])
    end

    for type <- [:link, :pin],
        href <- [
          "javascript:alert(1)",
          "data:text/html,x",
          "//example.test/a",
          "https://",
          "https://example.test:bad",
          "https://user@example.test",
          "/\\example.test",
          "/has space",
          "\nhttps://example.test"
        ] do
      parent = if type == :pin, do: "tab", else: "group"
      item = node("item", type, parent, 0, %{href: href})
      assert {:error, :invalid_tree_change} = TargetTree.build([tab, group], [upsert(item)])
    end
  end

  test "rejects duplicate sibling slots, titles, page identities and duplicate changes" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)
    one = node("one", :link, "group", 0, %{href: "/one"})
    two = node("two", :link, "group", 0, %{href: "/two"})

    assert {:error, :duplicate_tree_identity} =
             TargetTree.build([tab, group], [upsert(one), upsert(two)])

    assert {:error, :duplicate_tree_identity} =
             TargetTree.build([tab, group], [upsert(%{one | index: 1})])

    assert {:error, :duplicate_tree_identity} =
             TargetTree.build([tab, group], [upsert(one), upsert(%{two | index: 1, title: "one"})])

    doc = Ecto.UUID.generate()
    one_page = node("one", :page, "group", 0, %{doc_id: doc})
    two_page = node("two", :page, "group", 1, %{doc_id: String.upcase(doc)})

    assert {:error, :duplicate_tree_identity} =
             TargetTree.build([tab, group], [upsert(one_page), upsert(two_page)])

    assert {:error, :invalid_tree_change} =
             TargetTree.build([tab], [upsert(group), upsert(group)])
  end

  test "requires full typed content and rejects excessive depth" do
    tab = node("tab", :tab, nil, 0)
    group = node("group", :group, "tab", 0)

    assert {:error, :invalid_tree_change} =
             TargetTree.build([tab], [
               %{node_id: "group", change_type: :upsert, target: %{type: :group}}
             ])

    assert {:error, :invalid_tree_change} =
             TargetTree.build([tab], [upsert(%{group | hidden: nil})])

    deep =
      Enum.map(1..33, fn i ->
        node("g#{i}", :group, if(i == 1, do: "tab", else: "g#{i - 1}"), 0)
      end)

    assert {:error, :invalid_tree_parent} = TargetTree.build([tab], Enum.map(deep, &upsert/1))
  end

  test "does not hide an invalid public baseline by repairing it in the queue" do
    tab = node("tab", :tab, nil, 0)
    orphan = node("group", :group, "missing", 0)

    assert {:error, :invalid_tree_parent} =
             TargetTree.build([tab, orphan], [upsert(%{orphan | parent_node_id: "tab"})])
  end

  test "rejects a Group placed after a Page or Link in one navigation lane" do
    tab = node("tab", :tab, nil, 0)
    parent = node("parent", :group, "tab", 0)
    link = node("link", :link, "parent", 0, %{href: "/link"})
    group = node("group", :group, "parent", 1)

    assert {:error, :duplicate_tree_identity} = TargetTree.build([tab, parent, link, group], [])
  end
end
