defmodule GroupherServer.CMS.DocTree.Publish.TreeOrder do
  @moduledoc """
  Computes queue-view sibling positions for moves and subtree removals.

      validated queue tree -> insert, move or remove -> reindexed complete target tree

  The caller owns locking, authorization, discard confirmation and persistence.
  Positions are calculated from the supplied queue view, never the draft tree.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.TargetTree

  @doc "Inserts a new node into its queue-view sibling lane."
  def insert(nodes, %{node_id: id, parent_node_id: parent, type: _type} = node, position)
      when is_list(nodes) and is_binary(id) and is_integer(position) and position >= 0 do
    with {:ok, original} <- TargetTree.build(nodes, []),
         false <- Enum.any?(original, &(&1.node_id == id)),
         {:ok, result} <- move_node(original, node, parent, position),
         {:ok, target} <- TargetTree.build(result, []) do
      {:ok, %{target: target, changed: changed(original, target)}}
    else
      true -> {:error, :tree_node_already_exists}
      {:error, _reason} = error -> error
    end
  end

  def insert(_, _, _), do: {:error, :invalid_tree_order_input}

  @doc "Moves one node and returns the target tree and all changed nodes."
  def move(nodes, id, parent_id, position)
      when is_list(nodes) and is_binary(id) and is_integer(position) and position >= 0 do
    with {:ok, original} <- TargetTree.build(nodes, []),
         %{type: _type} = moving <- Enum.find(original, &(&1.node_id == id)),
         {:ok, result} <- move_node(original, moving, parent_id, position),
         {:ok, target} <- TargetTree.build(result, []) do
      {:ok, %{target: target, changed: changed(original, target)}}
    else
      nil -> {:error, :tree_node_not_found}
      {:error, _reason} = error -> error
    end
  end

  def move(_, _, _, _), do: {:error, :invalid_tree_order_input}

  @doc "Removes explicitly listed nodes and reindexes their surviving sibling lanes."
  def remove(nodes, ids) when is_list(nodes) and is_list(ids) do
    with {:ok, original} <- TargetTree.build(nodes, []),
         true <- Enum.all?(ids, &is_binary/1) and length(ids) == MapSet.size(MapSet.new(ids)),
         removed = MapSet.new(ids),
         true <- MapSet.subset?(removed, MapSet.new(original, & &1.node_id)),
         lanes =
           original
           |> Enum.filter(&MapSet.member?(removed, &1.node_id))
           |> Enum.map(&lane/1)
           |> Enum.uniq(),
         survivors = Enum.reject(original, &MapSet.member?(removed, &1.node_id)),
         reindexed = Enum.reduce(lanes, survivors, &reindex_lane(&2, &1)),
         {:ok, target} <- TargetTree.build(reindexed, []) do
      {:ok, %{target: target, changed: changed(original, target)}}
    else
      false -> {:error, :invalid_tree_removal}
      {:error, _reason} = error -> error
    end
  end

  def remove(_, _), do: {:error, :invalid_tree_order_input}

  defp move_node(original, moving, parent_id, position) do
    before_lane = lane(moving)
    moved = %{moving | parent_node_id: parent_id}
    after_lane = lane(moved)
    remaining = Enum.reject(original, &(&1.node_id == moving.node_id))

    remaining =
      if before_lane == after_lane, do: remaining, else: reindex_lane(remaining, before_lane)

    siblings = siblings(remaining, after_lane)
    index = insertion_index(siblings, moving.type, position)
    ordered = List.insert_at(siblings, index, moved) |> Enum.with_index()

    replacements =
      Map.new(ordered, fn {node, index} -> {node.node_id, Map.put(node, :index, index)} end)

    {:ok,
     remaining
     |> Enum.reject(&(lane(&1) == after_lane))
     |> Kernel.++(Map.values(replacements))}
  end

  defp reindex_lane(nodes, lane) do
    updated =
      nodes
      |> siblings(lane)
      |> Enum.with_index()
      |> Map.new(fn {node, index} -> {node.node_id, %{node | index: index}} end)

    Enum.map(nodes, &Map.get(updated, &1.node_id, &1))
  end

  defp siblings(nodes, lane) do
    nodes
    |> Enum.filter(&(lane(&1) == lane))
    |> Enum.sort_by(&{rank(&1.type), &1.index, &1.node_id})
  end

  defp insertion_index(siblings, :group, position) do
    min(position, Enum.count(siblings, &(&1.type == :group)))
  end

  defp insertion_index(siblings, type, position) when type in [:page, :link] do
    position |> max(Enum.count(siblings, &(&1.type == :group))) |> min(length(siblings))
  end

  defp insertion_index(siblings, _type, position), do: min(position, length(siblings))

  defp rank(:group), do: 0
  defp rank(_), do: 1

  defp lane(%{type: :tab}), do: {:tabs, nil}
  defp lane(%{type: :pin, parent_node_id: parent}), do: {:pins, parent}
  defp lane(%{parent_node_id: parent}), do: {:navigation, parent}

  defp changed(original, target) do
    by_id = Map.new(original, &{&1.node_id, &1})
    Enum.filter(target, &(Map.get(by_id, &1.node_id) != &1))
  end
end
