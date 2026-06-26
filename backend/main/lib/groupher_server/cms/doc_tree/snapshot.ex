defmodule GroupherServer.CMS.DocTree.Snapshot do
  @moduledoc """
  Canonical JSON snapshots for docs Tree.

      doc_tree_node_drafts(type=group/page/link/pin)
                     |
                     v
              canonical tree_json
                     |
          +----------+----------+
          |                     |
      tree_hash          doc_tree_revisions

  The snapshot is deliberately a product-level JSON shape, not raw DB rows. It
  is stable enough for review/diff and small enough to materialize on publish.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Community,
    DocTreeNode,
    DocTreeNodeDraft
  }

  @tree_version 1

  @doc """
  Returns canonical draft-tree JSON for one community.

  Pins are root-level Tree nodes, so they live beside groups in the same
  snapshot even though the feature UI is not implemented yet.
  """
  @spec draft_json(Community.t()) :: map()
  def draft_json(%Community{} = community) do
    nodes =
      DocTreeNodeDraft
      |> where([n], n.community_id == ^community.id)
      |> where([n], is_nil(n.deleted_at))
      |> order_by([n], asc: n.index, asc: n.id)
      |> Repo.all()

    tree_json(nodes)
  end

  @doc """
  Returns canonical published-tree JSON for one community.
  """
  @spec published_json(Community.t()) :: map()
  def published_json(%Community{} = community) do
    nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> order_by([n], asc: n.index, asc: n.id)
      |> Repo.all()

    tree_json(nodes)
  end

  @doc """
  Computes a stable content hash for canonical tree JSON.
  """
  @spec hash(map()) :: String.t()
  def hash(tree_json) when is_map(tree_json) do
    :crypto.hash(:sha256, Jason.encode!(tree_json))
    |> Base.encode16(case: :lower)
  end

  @doc """
  Converts a draft or published node into the canonical snapshot node shape.
  """
  @spec node_json(DocTreeNodeDraft.t() | DocTreeNode.t()) :: map()
  def node_json(node) do
    %{
      "id" => to_string(node.id),
      "type" => to_string(node.type),
      "title" => node.title,
      "slug" => node.slug,
      "docId" => doc_id(node),
      "targetNodeId" => target_node_id(node),
      "href" => node.href,
      "marker" => node.marker,
      "badge" => node.badge,
      "hidden" => node.hidden,
      "uiConfig" => node.ui_config
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp tree_json(nodes) do
    children_by_parent = nodes |> Enum.filter(& &1.parent_id) |> Enum.group_by(& &1.parent_id)

    pins =
      nodes
      |> Enum.filter(&(&1.type == :pin))
      |> Enum.map(&node_json/1)

    groups =
      nodes
      |> Enum.filter(&(&1.type == :group))
      |> Enum.map(fn group ->
        group
        |> node_json()
        |> Map.put(
          "children",
          Enum.map(Map.get(children_by_parent, group.id, []), &node_json/1)
        )
      end)

    %{
      "version" => @tree_version,
      "pins" => pins,
      "groups" => groups
    }
  end

  defp doc_id(%DocTreeNodeDraft{} = node),
    do: node.article_draft_id && to_string(node.article_draft_id)

  defp doc_id(%DocTreeNode{} = node), do: node.doc_id && to_string(node.doc_id)

  defp target_node_id(node), do: node.target_node_id && to_string(node.target_node_id)
end
