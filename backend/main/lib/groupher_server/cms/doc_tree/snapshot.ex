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
  alias CMS.Articles.Branch
  alias CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  @tree_version 2
  @tree_node_type_tab CMS.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)
  @tree_node_type_link CMS.Const.tree_node_type(:link)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)
  @pin_node_id to_string(@tree_node_type_pin)

  @doc """
  Returns canonical draft-tree JSON for one community.

  ## Examples

      iex> Snapshot.draft_json(community)
      %{"version" => 2, "tabs" => tabs}
  """
  @spec draft_json(Community.t(), keyword() | map()) :: map()
  def draft_json(%Community{} = community, opts \\ []),
    do: stage_json(community, opts, CMS.Const.stage(:draft))

  @doc """
  Returns canonical public-tree JSON for one community.

  ## Examples

      iex> Snapshot.published_json(community)
      %{"version" => 2, "tabs" => tabs}
  """
  @spec published_json(Community.t(), keyword() | map()) :: map()
  def published_json(%Community{} = community, opts \\ []),
    do: stage_json(community, opts, CMS.Const.stage(:public))

  @doc """
  Returns canonical JSON from a pre-filtered node list.

  Tree publish uses this after filtering out doc-owned draft-only pages, so the
  stored snapshot matches the public tree materialized in the same transaction.

  ## Examples

      iex> Snapshot.from_nodes(nodes)["version"]
      2
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
      CMS.Const.doc_tree_json_key(:doc_id) => article_ref_id(node),
      "href" => node.href,
      "marker" => node.marker,
      "badge" => node.badge,
      "hidden" => node.hidden,
      "uiConfig" => node.ui_config
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp stage_json(%Community{} = community, opts, stage) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts) do
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == ^stage)
      |> order_by([n], asc: n.index, asc: n.id)
      |> Repo.all()
      |> tree_json()
    end
  end

  defp tree_json(nodes) do
    children_by_group =
      nodes
      |> Enum.filter(&(&1.group_id && &1.type in [@tree_node_type_page, @tree_node_type_link]))
      |> Enum.group_by(& &1.group_id)

    groups =
      nodes
      |> Enum.filter(&(&1.type == @tree_node_type_group and &1.node_id != @pin_node_id))
      |> Enum.map(fn group ->
        group
        |> node_json()
        |> Map.put("tabId", group.tab_id)
        |> Map.put(
          "children",
          Enum.map(Map.get(children_by_group, group.node_id, []), &node_json/1)
        )
      end)

    groups_by_tab = Enum.group_by(groups, & &1["tabId"])

    pins_by_tab =
      nodes
      |> Enum.filter(&(&1.type == @tree_node_type_pin))
      |> Enum.map(fn pin -> pin |> node_json() |> Map.put("tabId", pin.tab_id) end)
      |> Enum.group_by(& &1["tabId"])

    tabs =
      nodes
      |> Enum.filter(&(&1.type == @tree_node_type_tab))
      |> Enum.map(fn tab ->
        tab
        |> node_json()
        |> Map.put("pins", Map.get(pins_by_tab, tab.node_id, []))
        |> Map.put("groups", Map.get(groups_by_tab, tab.node_id, []))
      end)

    %{"version" => @tree_version, "tabs" => tabs}
  end

  defp article_ref_id(%DocTreeNode{stage: CMS.Const.stage(:draft)} = node),
    do: node.doc_id && to_string(node.doc_id)

  defp article_ref_id(%DocTreeNode{stage: CMS.Const.stage(:public)} = node),
    do: node.doc_id && to_string(node.doc_id)
end
