defmodule GroupherServer.CMS.DocTree.Snapshot do
  @moduledoc """
  Canonical JSON snapshots for docs Tree publish history.

      doc_tree_nodes(stage=draft/public)
                    |
                    v
             canonical tree_json
                    |
                    v
             doc_tree_snapshots

  Snapshot JSON uses stable `node_id` values, not physical row ids. This is the
  middle layer used by Tree diff/review UI.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  @tree_version 1

  @doc """
  Returns canonical draft-tree JSON for one community.

  ## Examples

      iex> Snapshot.draft_json(community)
      %{"version" => 1, "groups" => groups}
  """
  @spec draft_json(Community.t()) :: map()
  def draft_json(%Community{} = community), do: stage_json(community, :draft)

  @doc """
  Returns canonical public-tree JSON for one community.

  ## Examples

      iex> Snapshot.published_json(community)
      %{"version" => 1}
  """
  @spec published_json(Community.t()) :: map()
  def published_json(%Community{} = community), do: stage_json(community, :public)

  @doc """
  Returns canonical JSON from a pre-filtered node list.

  Tree publish uses this after filtering out doc-owned draft-only pages, so the
  stored snapshot matches the public tree materialized in the same transaction.

  ## Examples

      iex> Snapshot.from_nodes(nodes)["version"]
      1
  """
  @spec from_nodes(list(DocTreeNode.t())) :: map()
  def from_nodes(nodes) when is_list(nodes), do: tree_json(nodes)

  @doc """
  Computes a stable content hash for canonical tree JSON.

  ## Examples

      iex> Snapshot.hash(%{"version" => 1})
      "..."
  """
  @spec hash(map()) :: String.t()
  def hash(tree_json) when is_map(tree_json) do
    :crypto.hash(:sha256, Jason.encode!(tree_json))
    |> Base.encode16(case: :lower)
  end

  @doc """
  Converts a tree node into the canonical snapshot node shape.

  ## Examples

      iex> Snapshot.node_json(node)["id"] == node.node_id
      true
  """
  @spec node_json(DocTreeNode.t()) :: map()
  def node_json(%DocTreeNode{} = node) do
    %{
      "id" => node.node_id,
      "type" => to_string(node.type),
      "title" => node.title,
      "slug" => node.slug,
      article_ref_key(node) => article_ref_id(node),
      "href" => node.href,
      "marker" => node.marker,
      "badge" => node.badge,
      "hidden" => node.hidden,
      "uiConfig" => node.ui_config
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp article_ref_key(%DocTreeNode{stage: CMS.Const.stage(:draft)}), do: "docId"
  defp article_ref_key(%DocTreeNode{stage: CMS.Const.stage(:public)}), do: "docId"
  defp article_ref_key(_node), do: "docId"

  defp stage_json(%Community{} = community, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == ^stage)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
    |> tree_json()
  end

  defp tree_json(nodes) do
    children_by_group =
      nodes
      |> Enum.filter(&(&1.group_id && &1.type in [:page, :link]))
      |> Enum.group_by(& &1.group_id)

    pins =
      nodes
      |> Enum.filter(&(&1.type == :pin))
      |> Enum.map(&node_json/1)

    groups =
      nodes
      |> Enum.filter(&(&1.type == :group and &1.node_id != "pin"))
      |> Enum.map(fn group ->
        group
        |> node_json()
        |> Map.put(
          "children",
          Enum.map(Map.get(children_by_group, group.node_id, []), &node_json/1)
        )
      end)

    %{"version" => @tree_version, "pins" => pins, "groups" => groups}
  end

  defp article_ref_id(%DocTreeNode{stage: CMS.Const.stage(:draft)} = node),
    do: node.doc_id && to_string(node.doc_id)

  defp article_ref_id(%DocTreeNode{stage: CMS.Const.stage(:public)} = node),
    do: node.doc_id && to_string(node.doc_id)
end
