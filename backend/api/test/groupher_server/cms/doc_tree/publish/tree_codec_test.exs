defmodule GroupherServer.Test.CMS.DocTree.Publish.TreeCodecTest do
  use GroupherServer.TestMate

  alias GroupherServer.{Repo, CMS}
  alias CMS.DocTree.Publish.{Plan, TreeCodec}

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

  test "round trips real PostgreSQL JSONB and feeds the same plan as typed values" do
    baseline = [node("tab", :tab, nil, 0), node("group", :group, "tab", 0)]
    link = node("link", :link, "group", 0, %{href: "/foo", marker: %{"color" => "red"}})
    assert {:ok, encoded} = TreeCodec.encode(baseline)

    [[stored]] = Repo.query!("SELECT $1::jsonb", [encoded]).rows
    assert {:ok, decoded} = TreeCodec.decode(stored)
    assert decoded == Enum.sort_by(baseline, & &1.node_id)

    target_json = %{
      "type" => "link",
      "parent_node_id" => "group",
      "index" => 0,
      "title" => "link",
      "href" => "/foo",
      "doc_id" => nil,
      "marker" => %{"color" => "red"},
      "badge" => nil,
      "hidden" => false
    }

    assert {:ok, ^target_json} = TreeCodec.encode_target([link | baseline], "link")
    assert {:error, :tree_node_not_found} = TreeCodec.encode_target(baseline, "missing")

    [[stored_target]] = Repo.query!("SELECT $1::jsonb", [target_json]).rows
    rows = [%{node_id: "link", change_kind: :upsert, target: stored_target}]
    typed = [%{node_id: "link", change_kind: :upsert, target: Map.delete(link, :node_id)}]

    assert {:ok, from_storage} = Plan.build_from_storage(1, stored, rows, [], [])
    assert {:ok, from_typed} = Plan.build(1, baseline, typed, [], [])
    assert from_storage == from_typed
  end

  test "rejects unsupported versions, missing fields, unknown fields and unknown types" do
    assert {:error, :invalid_tree_snapshot} = TreeCodec.decode(%{"version" => 2, "nodes" => []})

    assert {:error, :invalid_tree_snapshot} =
             TreeCodec.decode(%{"version" => 1, "nodes" => [], "extra" => true})

    assert {:ok, encoded} = TreeCodec.encode([node("tab", :tab, nil, 0)])
    [tab] = encoded["nodes"]

    assert {:error, :invalid_tree_target} =
             TreeCodec.decode(%{encoded | "nodes" => [Map.delete(tab, "hidden")]})

    assert {:error, :invalid_tree_target} =
             TreeCodec.decode(%{encoded | "nodes" => [Map.put(tab, "type", "unknown")]})

    assert {:error, :invalid_tree_change} =
             TreeCodec.decode_changes([%{node_id: "tab", change_kind: :delete, target: %{}}])
  end
end
