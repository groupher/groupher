defmodule GroupherServer.CMS.DocTree.Import do
  @moduledoc """
  Projects one imported navigation tree inside the caller's Doc apply transaction.

  Imported source identities are hashed into stable `node_id` values. Existing
  nodes are updated in place, new nodes are inserted, and nodes absent from a
  later source snapshot are deliberately retained until the user resolves the
  `source_deleted` diff.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ContentImport.Canonical
  alias CMS.DocTree.{Read, Revision}
  alias CMS.Model.{ArticleBranch, Community, DocTreeNode}
  alias Helper.ORM

  require CMS.Const

  @spec apply(Community.t(), ArticleBranch.t(), map(), map()) ::
          {:ok, %{nodes: [DocTreeNode.t()], state: CMS.Model.DocsSiteState.t()}}
          | {:error, term()}
  def apply(%Community{} = community, %ArticleBranch{} = branch, tree, items_by_target)
      when is_map(tree) and is_map(items_by_target) do
    with {:ok, state} <- Read.ensure_draft_state(community, branch_id: branch.id),
         {:ok, nodes} <-
           upsert_tabs(community, branch, Map.get(tree, "tabs", []), items_by_target),
         {:ok, state} <- Revision.bump_tree_draft(community, state) do
      {:ok, %{nodes: nodes, state: state}}
    end
  end

  defp upsert_tabs(community, branch, tabs, items_by_target) when is_list(tabs) do
    tabs
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {tab, index}, {:ok, nodes} ->
      tab_id = node_id(:tab, tab["sourceId"])

      attrs = base_attrs(community, branch, tab, :tab, tab_id, index)

      with {:ok, tab_node} <- upsert_node(community, branch, attrs),
           {:ok, group_nodes} <-
             upsert_groups(
               community,
               branch,
               tab_id,
               Map.get(tab, "groups", []),
               items_by_target
             ),
           {:ok, pin_nodes} <-
             upsert_pins(community, branch, tab_id, Map.get(tab, "pins", [])) do
        {:cont, {:ok, nodes ++ [tab_node] ++ group_nodes ++ pin_nodes}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp upsert_tabs(_community, _branch, _tabs, _items_by_target),
    do: {:error, {:custom, "imported Doc tree tabs are invalid"}}

  defp upsert_groups(community, branch, tab_id, groups, items_by_target) when is_list(groups) do
    groups
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {group, index}, {:ok, nodes} ->
      group_id = node_id(:group, group["sourceId"])

      attrs =
        community
        |> base_attrs(branch, group, :group, group_id, index)
        |> Map.put(:tab_id, tab_id)

      with {:ok, group_node} <- upsert_node(community, branch, attrs),
           {:ok, children} <-
             upsert_children(
               community,
               branch,
               group_id,
               Map.get(group, "children", []),
               items_by_target
             ) do
        {:cont, {:ok, nodes ++ [group_node] ++ children}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp upsert_groups(_community, _branch, _tab_id, _groups, _items_by_target),
    do: {:error, {:custom, "imported Doc tree groups are invalid"}}

  defp upsert_children(community, branch, group_id, children, items_by_target)
       when is_list(children) do
    children
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {child, index}, {:ok, nodes} ->
      case child["type"] do
        "page" ->
          target_ref = child["docId"]

          if Map.has_key?(items_by_target, target_ref) do
            attrs =
              community
              |> base_attrs(branch, child, :page, node_id(:page, child["sourceId"]), index)
              |> Map.put(:group_id, group_id)
              |> Map.put(:doc_id, target_ref)

            append_node(nodes, upsert_node(community, branch, attrs))
          else
            {:cont, {:ok, nodes}}
          end

        "link" ->
          attrs =
            community
            |> base_attrs(branch, child, :link, node_id(:link, child["sourceId"]), index)
            |> Map.put(:group_id, group_id)
            |> Map.put(:href, child["href"])

          append_node(nodes, upsert_node(community, branch, attrs))

        _ ->
          {:halt, {:error, {:custom, "imported Doc tree child type is invalid"}}}
      end
    end)
  end

  defp upsert_children(_community, _branch, _group_id, _children, _items_by_target),
    do: {:error, {:custom, "imported Doc tree children are invalid"}}

  defp upsert_pins(community, branch, tab_id, pins) when is_list(pins) do
    pins
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {pin, index}, {:ok, nodes} ->
      attrs =
        community
        |> base_attrs(branch, pin, :pin, node_id(:pin, pin["sourceId"]), index)
        |> Map.put(:tab_id, tab_id)
        |> Map.put(:href, pin["href"])

      append_node(nodes, upsert_node(community, branch, attrs))
    end)
  end

  defp upsert_pins(_community, _branch, _tab_id, _pins),
    do: {:error, {:custom, "imported Doc tree pins are invalid"}}

  defp append_node(nodes, {:ok, node}), do: {:cont, {:ok, nodes ++ [node]}}
  defp append_node(_nodes, {:error, _} = error), do: {:halt, error}

  defp base_attrs(%Community{} = community, branch, source, type, source_node_id, index) do
    %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: source_node_id,
      stage: CMS.Const.stage(:draft),
      type: type,
      title: source["title"],
      slug: source["slug"],
      index: index
    }
  end

  defp upsert_node(community, branch, attrs) do
    case Repo.get_by(DocTreeNode,
           community_id: community.id,
           branch_id: branch.id,
           stage: CMS.Const.stage(:draft),
           node_id: attrs.node_id
         ) do
      nil ->
        ORM.create(DocTreeNode, attrs)

      %DocTreeNode{} = node ->
        ORM.update(node, Map.drop(attrs, [:community_id, :branch_id, :stage]))
    end
  end

  defp node_id(type, source_id) when is_binary(source_id) and source_id != "" do
    hash = Canonical.sha256(%{type: Atom.to_string(type), source_id: source_id})
    "import:#{Atom.to_string(type)}:" <> String.slice(hash, 0, 48)
  end

  defp node_id(type, source_id), do: node_id(type, inspect(source_id))
end
