defmodule GroupherServer.CMS.DocTree.Publish.TreeCodec do
  @moduledoc """
  Converts the V1 release tree and queue target JSON into typed planner values.

      persisted JSONB -> fixed field/type decoding -> TargetTree / Plan

  Only the V1 representation is accepted; no historical tree format is read.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.TargetTree

  @version 1
  @fields ~w(type parent_node_id index title href doc_id marker badge hidden)
  @type_values %{
    "tab" => :tab,
    "group" => :group,
    "page" => :page,
    "link" => :link,
    "pin" => :pin
  }

  @doc "Encodes validated typed nodes into a complete V1 release tree JSON object."
  def encode(nodes) when is_list(nodes) do
    with {:ok, nodes} <- TargetTree.build(nodes, []) do
      {:ok, %{"version" => @version, "nodes" => Enum.map(nodes, &encode_node/1)}}
    end
  end

  def encode(_), do: {:error, :invalid_tree_snapshot}

  @doc "Encodes one validated target node for a queue upsert JSONB column."
  def encode_target(nodes, node_id) when is_list(nodes) and is_binary(node_id) do
    with {:ok, %{"nodes" => encoded}} <- encode(nodes),
         %{} = node <- Enum.find(encoded, &(&1["node_id"] == node_id)) do
      {:ok, Map.delete(node, "node_id")}
    else
      nil -> {:error, :tree_node_not_found}
      {:error, _reason} = error -> error
    end
  end

  def encode_target(_, _), do: {:error, :invalid_tree_target}

  @doc "Decodes and validates a V1 release tree JSON object."
  def decode(%{"version" => @version, "nodes" => nodes} = tree) when is_list(nodes) do
    with true <- MapSet.new(Map.keys(tree)) == MapSet.new(["version", "nodes"]),
         {:ok, decoded} <- map_nodes(nodes),
         {:ok, validated} <- TargetTree.build(decoded, []) do
      {:ok, validated}
    else
      false -> {:error, :invalid_tree_snapshot}
      {:error, _reason} = error -> error
    end
  end

  def decode(_), do: {:error, :invalid_tree_snapshot}

  @doc "Decodes persisted queue tree change rows with JSONB targets."
  def decode_changes(changes) when is_list(changes) do
    Enum.reduce_while(changes, {:ok, []}, fn change, {:ok, acc} ->
      case decode_change(change) do
        {:ok, decoded} -> {:cont, {:ok, [decoded | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, decoded} -> {:ok, Enum.reverse(decoded)}
      error -> error
    end
  end

  def decode_changes(_), do: {:error, :invalid_tree_change}

  defp map_nodes(nodes) do
    Enum.reduce_while(nodes, {:ok, []}, fn node, {:ok, acc} ->
      case decode_node(node) do
        {:ok, decoded} -> {:cont, {:ok, [decoded | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, decoded} -> {:ok, Enum.reverse(decoded)}
      error -> error
    end
  end

  defp decode_change(%{node_id: id, change_type: :delete, target: nil}) when is_binary(id) do
    {:ok, %{node_id: id, change_type: :delete, target: nil}}
  end

  defp decode_change(%{node_id: id, change_type: :upsert, target: target}) when is_binary(id) do
    with {:ok, decoded} <- decode_target(target) do
      {:ok, %{node_id: id, change_type: :upsert, target: decoded}}
    end
  end

  defp decode_change(_), do: {:error, :invalid_tree_change}

  defp decode_node(%{"node_id" => id} = node) when is_binary(id) do
    with {:ok, target} <- decode_target(Map.delete(node, "node_id")) do
      {:ok, Map.put(target, :node_id, id)}
    end
  end

  defp decode_node(_), do: {:error, :invalid_tree_snapshot}

  defp decode_target(target) when is_map(target) do
    with true <- MapSet.new(Map.keys(target)) == MapSet.new(@fields),
         {:ok, type} <- Map.fetch(@type_values, target["type"]) do
      {:ok,
       %{
         type: type,
         parent_node_id: target["parent_node_id"],
         index: target["index"],
         title: target["title"],
         href: target["href"],
         doc_id: target["doc_id"],
         marker: target["marker"],
         badge: target["badge"],
         hidden: target["hidden"]
       }}
    else
      _ -> {:error, :invalid_tree_target}
    end
  end

  defp decode_target(_), do: {:error, :invalid_tree_target}

  defp encode_node(node) do
    %{
      "node_id" => node.node_id,
      "type" => Atom.to_string(node.type),
      "parent_node_id" => node.parent_node_id,
      "index" => node.index,
      "title" => node.title,
      "href" => node.href,
      "doc_id" => node.doc_id,
      "marker" => node.marker,
      "badge" => node.badge,
      "hidden" => node.hidden
    }
  end
end
