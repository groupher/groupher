defmodule GroupherServer.CMS.DocTree.Publish.TreeOperations do
  @moduledoc """
  Derives deterministic, dependency-ordered net operations for a queue tree.

      public tree + queue members -> validated target -> ordered create/update/delete operations

  This planner does not mutate storage or check Doc ownership and visibility.
  The executor must handle sibling index uniqueness within its transaction.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.{Const, Publish.TargetTree}

  @max_depth Const.max_depth()

  @doc "Returns the validated target tree and its ordered net operations."
  def plan(public_nodes, changes) do
    with {:ok, public} <- TargetTree.build(public_nodes, []),
         {:ok, target} <- TargetTree.build(public, changes),
         {:ok, operations} <- diff(public, target),
         {:ok, ordered} <- order(operations, Map.new(public, &{&1.node_id, &1}), []) do
      {:ok, %{target: target, operations: ordered}}
    end
  end

  defp diff(public, target) do
    before = Map.new(public, &{&1.node_id, &1})
    after_nodes = Map.new(target, &{&1.node_id, &1})
    ids = (Map.keys(before) ++ Map.keys(after_nodes)) |> Enum.uniq() |> Enum.sort()

    Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, acc} ->
      case {Map.get(before, id), Map.get(after_nodes, id)} do
        {nil, node} ->
          {:cont, {:ok, [%{node_id: id, action: :create, before: nil, target: node} | acc]}}

        {node, nil} ->
          {:cont, {:ok, [%{node_id: id, action: :delete, before: node, target: nil} | acc]}}

        {%{type: type} = old, %{type: type} = new} when old == new ->
          {:cont, {:ok, acc}}

        {%{type: type} = old, %{type: type} = new} ->
          {:cont, {:ok, [%{node_id: id, action: :update, before: old, target: new} | acc]}}

        _ ->
          {:halt, {:error, :tree_node_type_changed}}
      end
    end)
    |> case do
      {:ok, operations} -> {:ok, Enum.reverse(operations)}
      error -> error
    end
  end

  defp order([], _current, result), do: {:ok, Enum.reverse(result)}

  defp order(remaining, current, result) do
    case Enum.find(remaining, &ready?(&1, current)) do
      nil ->
        {:error, :tree_operation_dependency_conflict}

      operation ->
        next = apply_operation(operation, current)
        order(List.delete(remaining, operation), next, [operation | result])
    end
  end

  defp ready?(%{action: :delete, node_id: id}, current) do
    not Enum.any?(current, fn {_key, node} -> node.parent_node_id == id end)
  end

  defp ready?(%{target: %{type: :tab}}, _current), do: true

  defp ready?(%{node_id: id, target: target}, current) do
    parent = Map.get(current, target.parent_node_id)

    parent_allowed?(target.type, parent) and not ancestor?(parent, id, current) and
      depth(parent, current) + 1 + subtree_height(id, current) <= @max_depth
  end

  defp parent_allowed?(:group, %{type: type}), do: type in [:tab, :group]
  defp parent_allowed?(type, %{type: :group}) when type in [:page, :link], do: true
  defp parent_allowed?(:pin, %{type: :tab}), do: true
  defp parent_allowed?(_, _), do: false

  defp ancestor?(nil, _id, _current), do: false
  defp ancestor?(%{node_id: id}, id, _current), do: true
  defp ancestor?(%{type: :tab}, _id, _current), do: false

  defp ancestor?(node, id, current) do
    ancestor?(Map.get(current, node.parent_node_id), id, current)
  end

  defp depth(%{type: :tab}, _current), do: 0
  defp depth(node, current), do: 1 + depth(Map.fetch!(current, node.parent_node_id), current)

  defp subtree_height(id, current) do
    current
    |> Enum.filter(fn {_key, node} -> node.parent_node_id == id end)
    |> Enum.reduce(0, fn {child_id, _node}, height ->
      max(height, 1 + subtree_height(child_id, current))
    end)
  end

  defp apply_operation(%{action: :delete, node_id: id}, current), do: Map.delete(current, id)

  defp apply_operation(%{node_id: id, target: target}, current) do
    Map.put(current, id, target)
  end
end
