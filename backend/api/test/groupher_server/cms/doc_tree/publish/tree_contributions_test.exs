defmodule GroupherServer.CMS.DocTree.Publish.TreeContributionsTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.TreeContributions

  defp fixture_node do
    %{
      node_id: "item",
      type: :link,
      parent_node_id: "group",
      index: 0,
      title: "Public",
      href: "/docs",
      doc_id: nil,
      marker: nil,
      badge: nil,
      hidden: false
    }
  end

  test "keeps only authors of current net fields and updates the last field author" do
    public = fixture_node()
    renamed = %{public | title: "A"}
    moved = %{renamed | index: 1}

    assert {:ok, %{title: 1} = authors} =
             TreeContributions.reconcile(public, public, renamed, %{}, 1)

    assert {:ok, %{title: 1, index: 2} = authors} =
             TreeContributions.reconcile(public, renamed, moved, authors, 2)

    assert {:ok, %{title: 1} = authors} =
             TreeContributions.reconcile(public, moved, renamed, authors, 3)

    assert {:ok, %{title: 3}} =
             TreeContributions.reconcile(public, renamed, %{renamed | title: "C"}, authors, 3)

    assert {:ok, %{}} = TreeContributions.reconcile(public, renamed, public, authors, 3)
  end

  test "new node creation stays attributed until removed, while changes replace individual authors" do
    node = fixture_node()
    assert {:ok, authors} = TreeContributions.reconcile(nil, nil, node, %{}, 1)
    assert map_size(authors) == 9
    assert Enum.all?(authors, fn {_, id} -> id == 1 end)

    assert {:ok, updated} =
             TreeContributions.reconcile(nil, node, %{node | title: "B"}, authors, 2)

    assert updated.existence == 1
    assert updated.title == 2
    assert {:ok, %{}} = TreeContributions.reconcile(nil, %{node | title: "B"}, nil, updated, 3)
  end

  test "delete and restore replace existence contribution and reject invalid stored attribution" do
    public = fixture_node()

    assert {:ok, %{existence: 2} = deleted} =
             TreeContributions.reconcile(public, public, nil, %{}, 2)

    assert {:ok, %{}} = TreeContributions.reconcile(public, nil, public, deleted, 3)

    assert {:ok, %{title: 3}} =
             TreeContributions.reconcile(public, nil, %{public | title: "C"}, deleted, 3)

    assert {:error, :invalid_tree_contributions} =
             TreeContributions.reconcile(public, public, nil, %{title: 1}, 2)

    assert {:error, :invalid_tree_contributions} =
             TreeContributions.reconcile(public, public, %{public | type: :page}, %{}, 2)
  end
end
