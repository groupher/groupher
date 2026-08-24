defmodule GroupherServer.CMS.DocTree.Writer.Node do
  require GroupherServer.CMS.DocTree.Const
  @moduledoc """
  Finds draft tree nodes and validates structural parent rules.

      node_id
          |
          v
      doc_tree_nodes(stage=draft)
          |
          +--> parent lookup
          +--> move target validation
          +--> new node_id generation for creates/copies

  Parent policy lives here so every write path agrees on the recursive shape:
  Tabs are roots; Groups belong to a Tab or Group; Page/Link nodes belong to a
  Group; Pins belong directly to a Tab. Moving a Group below itself or one of
  its descendants is rejected here.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Model.{Community, DocTreeNode}

  require CMS.Const

  @max_depth CMS.DocTree.Const.max_depth()

  @doc "Adds a stable logical node id when create attributes do not already provide one."
  def put_new_node_id(attrs), do: Map.put_new(attrs, :node_id, new_node_id())

  @doc "Generates a stable logical Docs Tree node id."
  def new_node_id, do: Ecto.UUID.generate()

  @doc "Finds one draft Tree node by stable logical `node_id`."
  def find(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      _ -> {:error, GroupherServer.ErrorCat.custom("doc tree node not found")}
    end
  end

  @doc "Resolves a legal Group parent, which may be a Tab or another Group."
  def navigation_parent(%Community{} = community, branch, parent_node_id) do
    with {:ok, parent} <- find(community, branch, parent_node_id),
         true <- parent.type in [:tab, :group],
         :ok <- validate_new_child_depth(community, branch, parent) do
      {:ok, parent}
    else
      false ->
        {:error, GroupherServer.ErrorCat.custom("navigation parent must be a tab or group")}

      error ->
        error
    end
  end

  @doc "Resolves the required Group parent for a Page or Link."
  def group_parent(%Community{} = community, branch, parent_node_id) do
    with {:ok, parent} <- find(community, branch, parent_node_id),
         true <- parent.type == :group,
         :ok <- validate_new_child_depth(community, branch, parent) do
      {:ok, parent}
    else
      false -> {:error, GroupherServer.ErrorCat.custom("page and link parents must be a group")}
      error -> error
    end
  end

  @doc "Resolves the required direct Tab parent for a Pin."
  def pin_parent(%Community{} = community, branch, parent_node_id) do
    with {:ok, parent} <- find(community, branch, parent_node_id),
         true <- parent.type == :tab do
      {:ok, parent}
    else
      false -> {:error, GroupherServer.ErrorCat.custom("doc tree parent must be a tab")}
      error -> error
    end
  end

  @doc "Returns the first draft Tab in stable sibling order."
  def first_tab(%Community{} = community, branch) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.type == :tab)
    |> order_by([n], asc: n.index, asc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Validates a node's target parent and returns the parent's logical `node_id`.

  Tabs require no parent, Groups accept Tab/Group, Page/Link require Group,
  and Pins require Tab. Group moves also reject cycles.
  """
  def validate_target(_community, _branch, %{type: :tab}, nil), do: {:ok, nil}

  def validate_target(community, branch, %{type: :pin}, parent_node_id) do
    with {:ok, tab} <- pin_parent(community, branch, parent_node_id), do: {:ok, tab.node_id}
  end

  def validate_target(community, branch, %{type: :group} = node, parent_node_id) do
    with {:ok, parent} <- navigation_parent(community, branch, parent_node_id),
         :ok <- reject_cycle(community, branch, node, parent),
         :ok <- validate_moved_subtree_depth(community, branch, node, parent) do
      {:ok, parent.node_id}
    end
  end

  def validate_target(community, branch, %{type: type}, parent_node_id)
      when type in [:page, :link] do
    with {:ok, parent} <- group_parent(community, branch, parent_node_id),
         do: {:ok, parent.node_id}
  end

  def validate_target(_community, _branch, _node, _parent_node_id),
    do: {:error, GroupherServer.ErrorCat.custom("invalid docs tree target")}

  defp reject_cycle(_community, _branch, %{node_id: node_id}, %{node_id: node_id}),
    do: {:error, GroupherServer.ErrorCat.custom("a group can not be its own parent")}

  defp reject_cycle(community, branch, node, parent) do
    if descendant?(community, branch, node.node_id, parent.node_id),
      do:
        {:error,
         GroupherServer.ErrorCat.custom("a group can not move below one of its descendants")},
      else: :ok
  end

  defp validate_new_child_depth(community, branch, parent) do
    placements = draft_placements(community, branch)

    with {:ok, parent_depth} <- node_depth(placements, parent.node_id) do
      validate_max_depth(parent_depth + 1)
    end
  end

  defp validate_moved_subtree_depth(community, branch, node, parent) do
    placements = draft_placements(community, branch)

    children_by_parent =
      Enum.group_by(placements, fn {_node_id, parent_node_id} -> parent_node_id end)

    with {:ok, parent_depth} <- node_depth(placements, parent.node_id),
         {:ok, subtree_height} <-
           subtree_height(children_by_parent, node.node_id, MapSet.new()) do
      validate_max_depth(parent_depth + 1 + subtree_height)
    end
  end

  defp validate_max_depth(depth) when depth <= @max_depth, do: :ok

  defp validate_max_depth(_depth),
    do:
      {:error, GroupherServer.ErrorCat.custom("Docs Tree exceeds maximum depth of #{@max_depth}")}

  defp node_depth(placements, node_id) do
    placements
    |> Map.new()
    |> walk_ancestor_depth(node_id, 0, MapSet.new())
  end

  defp walk_ancestor_depth(parents, current, depth, seen) do
    cond do
      MapSet.member?(seen, current) ->
        {:error, GroupherServer.ErrorCat.custom("Docs Tree contains a parent cycle")}

      true ->
        case Map.fetch(parents, current) do
          {:ok, nil} ->
            {:ok, depth}

          {:ok, parent_node_id} ->
            walk_ancestor_depth(
              parents,
              parent_node_id,
              depth + 1,
              MapSet.put(seen, current)
            )

          :error ->
            {:error, GroupherServer.ErrorCat.custom("Docs Tree parent chain is incomplete")}
        end
    end
  end

  defp subtree_height(children_by_parent, node_id, seen) do
    if MapSet.member?(seen, node_id) do
      {:error, GroupherServer.ErrorCat.custom("Docs Tree contains a parent cycle")}
    else
      children_by_parent
      |> Map.get(node_id, [])
      |> Enum.reduce_while({:ok, 0}, fn {child_node_id, _parent_node_id}, {:ok, height} ->
        case subtree_height(children_by_parent, child_node_id, MapSet.put(seen, node_id)) do
          {:ok, child_height} -> {:cont, {:ok, max(height, child_height + 1)}}
          error -> {:halt, error}
        end
      end)
    end
  end

  defp draft_placements(community, branch) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> select([n], {n.node_id, n.parent_node_id})
    |> Repo.all()
  end

  defp descendant?(community, branch, ancestor_node_id, candidate_node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> select([n], {n.node_id, n.parent_node_id})
    |> Repo.all()
    |> Map.new()
    |> ancestor_chain_contains?(candidate_node_id, ancestor_node_id, MapSet.new())
  end

  defp ancestor_chain_contains?(_parents, nil, _target, _seen), do: false

  defp ancestor_chain_contains?(parents, current, target, seen) do
    cond do
      current == target ->
        true

      MapSet.member?(seen, current) ->
        true

      true ->
        ancestor_chain_contains?(
          parents,
          Map.get(parents, current),
          target,
          MapSet.put(seen, current)
        )
    end
  end
end
