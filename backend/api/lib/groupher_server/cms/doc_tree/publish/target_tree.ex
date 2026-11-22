defmodule GroupherServer.CMS.DocTree.Publish.TargetTree do
  @moduledoc """
  Builds and validates the queue's target tree from a public tree and net changes.

      public nodes + queue changes -> complete validated target nodes

  This pure step does not authorize resources, check Doc ownership, or apply
  changes. The caller must do those checks against its transaction snapshot.
  Inputs are normalized atom-keyed node values with atom node types and
  atom change kinds; the persistence adapter must decode JSON before calling.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Const

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a
  @target_fields @fields -- [:node_id]
  @types [:tab, :group, :page, :link, :pin]
  @max_depth Const.max_depth()

  @doc "Builds a deterministic target node list or rejects an invalid tree."
  def build(public_nodes, changes) when is_list(public_nodes) and is_list(changes) do
    with {:ok, public} <- index_nodes(public_nodes),
         {:ok, :pass} <- validate_tree(public),
         {:ok, target} <- apply_changes(public, changes),
         {:ok, :pass} <- validate_tree(target) do
      {:ok, target |> Map.values() |> Enum.sort_by(& &1.node_id)}
    end
  end

  def build(_, _), do: {:error, :invalid_tree_input}

  defp index_nodes(nodes) do
    Enum.reduce_while(nodes, {:ok, %{}}, fn node, {:ok, indexed} ->
      if valid_node?(node) and not Map.has_key?(indexed, node.node_id) do
        {:cont, {:ok, Map.put(indexed, node.node_id, normalize_node(node))}}
      else
        {:halt, {:error, :invalid_public_node}}
      end
    end)
  end

  defp apply_changes(public, changes) do
    Enum.reduce_while(changes, {:ok, public, MapSet.new()}, fn change, {:ok, nodes, seen} ->
      with %{node_id: id, change_type: kind, target: target} <- change,
           true <- is_binary(id) and byte_size(id) > 0 and not MapSet.member?(seen, id),
           {:ok, nodes} <- apply_change(nodes, id, kind, target) do
        {:cont, {:ok, nodes, MapSet.put(seen, id)}}
      else
        _ -> {:halt, {:error, :invalid_tree_change}}
      end
    end)
    |> case do
      {:ok, nodes, _seen} -> {:ok, nodes}
      error -> error
    end
  end

  defp apply_change(nodes, id, :delete, nil) do
    if Map.has_key?(nodes, id), do: {:ok, Map.delete(nodes, id)}, else: {:error, :missing_node}
  end

  defp apply_change(nodes, id, :upsert, target) when is_map(target) do
    node = Map.put(Map.take(target, @target_fields), :node_id, id)

    if valid_node?(node) do
      {:ok, Map.put(nodes, id, normalize_node(node))}
    else
      {:error, :invalid_node}
    end
  end

  defp apply_change(_, _, _, _), do: {:error, :invalid_change}

  defp valid_node?(node) when is_map(node) do
    Enum.all?(@fields, &Map.has_key?(node, &1)) and
      is_binary(node.node_id) and byte_size(node.node_id) in 1..80 and
      node.type in @types and is_integer(node.index) and node.index >= 0 and
      is_binary(node.title) and String.trim(node.title) != "" and
      String.length(node.title) <= 100 and is_boolean(node.hidden) and
      (is_nil(node.marker) or is_map(node.marker)) and
      (is_nil(node.badge) or is_binary(node.badge)) and valid_shape?(node)
  end

  defp valid_node?(_), do: false

  defp normalize_node(%{type: :page} = node) do
    node |> Map.take(@fields) |> Map.update!(:doc_id, &Ecto.UUID.cast!/1)
  end

  defp normalize_node(node), do: Map.take(node, @fields)

  defp valid_shape?(%{type: :tab, parent_node_id: nil, doc_id: nil, href: nil}), do: true

  defp valid_shape?(%{type: :group, parent_node_id: parent, doc_id: nil, href: nil}) do
    valid_parent_id?(parent)
  end

  defp valid_shape?(%{type: :page, parent_node_id: parent, doc_id: doc, href: nil}) do
    valid_parent_id?(parent) and match?({:ok, _}, Ecto.UUID.cast(doc))
  end

  defp valid_shape?(%{type: type, parent_node_id: parent, doc_id: nil, href: href})
       when type in [:link, :pin] do
    valid_parent_id?(parent) and valid_href?(href)
  end

  defp valid_shape?(_), do: false

  defp valid_parent_id?(id), do: is_binary(id) and byte_size(id) in 1..80

  defp valid_href?(href) when is_binary(href) do
    if String.valid?(href) and byte_size(href) > 0 and String.length(href) <= 400 and
         not String.contains?(href, "\\") and not Regex.match?(~r/[\s\p{Cc}]/u, href) do
      case URI.new(href) do
        {:ok, %URI{scheme: scheme, host: host, userinfo: nil}}
        when scheme in ["http", "https"] and is_binary(host) and host != "" ->
          true

        {:ok, %URI{scheme: nil, host: nil}} ->
          true

        _ ->
          false
      end
    else
      false
    end
  end

  defp valid_href?(_href), do: false

  defp validate_tree(nodes) do
    with {:ok, :pass} <- validate_parents(nodes),
         {:ok, :pass} <- validate_unique(nodes) do
      {:ok, :pass}
    end
  end

  defp validate_parents(nodes) do
    Enum.reduce_while(nodes, {:ok, :pass}, fn {_id, node}, _ ->
      case ancestor_depth(node, nodes, MapSet.new()) do
        {:ok, depth} when depth <= @max_depth -> {:cont, {:ok, :pass}}
        _ -> {:halt, {:error, :invalid_tree_parent}}
      end
    end)
  end

  defp ancestor_depth(%{type: :tab}, _nodes, _seen), do: {:ok, 0}

  defp ancestor_depth(node, nodes, seen) do
    parent = Map.get(nodes, node.parent_node_id)

    if MapSet.member?(seen, node.node_id) or not valid_parent?(node, parent) do
      {:error, :invalid_tree_parent}
    else
      case ancestor_depth(parent, nodes, MapSet.put(seen, node.node_id)) do
        {:ok, depth} -> {:ok, depth + 1}
        error -> error
      end
    end
  end

  defp valid_parent?(%{type: :group}, %{type: type}), do: type in [:tab, :group]
  defp valid_parent?(%{type: type}, %{type: :group}) when type in [:page, :link], do: true
  defp valid_parent?(%{type: :pin}, %{type: :tab}), do: true
  defp valid_parent?(_, _), do: false

  defp validate_unique(nodes) do
    values = Map.values(nodes)
    indexes = Enum.map(values, &{lane(&1), &1.index})
    titles = values |> Enum.reject(&(&1.type == :pin)) |> Enum.map(&{lane(&1), &1.title})
    docs = values |> Enum.filter(&(&1.type == :page)) |> Enum.map(&Ecto.UUID.cast!(&1.doc_id))

    lanes = Enum.group_by(values, &lane/1)

    valid_positions? =
      Enum.all?(lanes, fn {_lane, siblings} ->
        ordered = Enum.sort_by(siblings, & &1.index)
        positions = Enum.map(ordered, & &1.index)
        after_groups = Enum.drop_while(ordered, &(&1.type == :group))

        positions == Enum.to_list(0..(length(positions) - 1)) and
          Enum.all?(after_groups, &(&1.type != :group))
      end)

    if unique?(indexes) and unique?(titles) and unique?(docs) and valid_positions? do
      {:ok, :pass}
    else
      {:error, :duplicate_tree_identity}
    end
  end

  defp lane(%{type: :tab}), do: {:tabs, nil}
  defp lane(%{type: :pin, parent_node_id: parent}), do: {:pins, parent}
  defp lane(%{parent_node_id: parent}), do: {:navigation, parent}
  defp unique?(values), do: length(values) == MapSet.size(MapSet.new(values))
end
