defmodule GroupherServer.CMS.DocTree.CommandReplay do
  @moduledoc """
  Versioned codec for DocTree command results that cannot be reconstructed by a Reader.

  `CMS.Command.Receipt` is the internal boundary; its `Runner` owns
  claim/finalize/replay orchestration. DocTree owns the JSON representation and
  bounded atom decoding for its result payloads.

      DocTree execute result
        -> versioned JSON-safe receipt payload
        -> CMS.Command.Receipt storage
        -> replay decode into the DocTree result shape
  """

  alias GroupherServer.CMS
  alias CMS.ErrorCat

  @schema_version 1
  @enum_fields [:type, :stage, :status, :restore_state]
  @enum_values ~w(tab group page link pin draft public icon emoji)

  @doc "Encodes a tree mutation result as a versioned receipt payload."
  @spec tree_metadata(map(), String.t()) :: map()
  def tree_metadata(%{revision: revision, affected_nodes: affected_nodes} = result, result_key)
      when is_integer(revision) and is_list(affected_nodes) do
    %{
      result_key: result_key,
      result_payload: %{
        "schema_version" => @schema_version,
        "revision" => revision,
        "tree_state" => json_safe(Map.get(result, :tree_state)),
        "node" => json_safe(Map.get(result, :node)),
        "affected_nodes" => json_safe(affected_nodes),
        "conflict" => Map.get(result, :conflict, false)
      }
    }
  end

  @doc false
  def tree_confirmation(result, result_key) do
    result
    |> tree_metadata(result_key)
    |> confirmation_data()
  end

  @doc "Encodes a subtree draft result that cannot be reconstructed by a Reader."
  @spec subtree_metadata(map()) :: map()
  def subtree_metadata(%{done: done, affected_count: affected_count})
      when is_boolean(done) and is_integer(affected_count) do
    %{
      result_payload: %{
        "schema_version" => @schema_version,
        "done" => done,
        "affected_count" => affected_count
      }
    }
  end

  @doc false
  def subtree_confirmation(result), do: result |> subtree_metadata() |> confirmation_data()

  @doc false
  def confirmation_data(metadata) when is_map(metadata) do
    Map.new(metadata, fn {key, value} -> {to_string(key), value} end)
  end

  @doc false
  def replay_confirmation(%{data: data}) when is_map(data) do
    replay_tree(%{
      result_key: data["result_key"],
      result_payload: data["result_payload"]
    })
  end

  @doc false
  def replay_subtree_confirmation(%{data: data}) when is_map(data) do
    replay_subtree(%{result_payload: data["result_payload"]})
  end

  @doc "Decodes one compatible tree receipt without executing the mutation again."
  @spec replay_tree(map()) :: {:ok, map()} | {:error, term()}
  def replay_tree(%{
        result_key: result_key,
        result_payload: %{"schema_version" => @schema_version, "revision" => revision} = payload
      }) do
    {:ok,
     %{
       revision: revision,
       tree_state: decode_tree_value(Map.get(payload, "tree_state", %{})),
       node: decode_tree_value(Map.get(payload, "node")),
       affected_nodes: decode_tree_value(Map.get(payload, "affected_nodes", [])),
       conflict: Map.get(payload, "conflict", false),
       command_result_key: result_key
     }}
  end

  def replay_tree(_receipt), do: {:error, ErrorCat.command_result_unavailable()}

  @doc "Decodes one compatible subtree receipt without repeating its writes."
  @spec replay_subtree(map()) :: {:ok, map()} | {:error, term()}
  def replay_subtree(%{
        result_payload: %{"schema_version" => @schema_version} = payload
      }) do
    {:ok,
     %{
       done: Map.get(payload, "done", true),
       affected_count: Map.get(payload, "affected_count", 0)
     }}
  end

  def replay_subtree(_receipt), do: {:error, ErrorCat.command_result_unavailable()}

  defp json_safe(nil), do: nil
  defp json_safe(value) when is_boolean(value), do: value
  defp json_safe(value) when is_atom(value), do: Atom.to_string(value)
  defp json_safe(value) when is_list(value), do: Enum.map(value, &json_safe/1)

  defp json_safe(value) when is_map(value) do
    Map.new(value, fn {key, item} -> {to_string(key), json_safe(item)} end)
  end

  defp json_safe(value), do: value

  defp decode_tree_value(value), do: decode_tree_value(value, nil)

  defp decode_tree_value(value, field) when is_list(value),
    do: Enum.map(value, &decode_tree_value(&1, field))

  defp decode_tree_value(value, _field) when is_map(value) do
    Map.new(value, fn {key, item} ->
      decoded_key = decode_tree_key(key)
      {decoded_key, decode_tree_value(item, decoded_key)}
    end)
  end

  defp decode_tree_value(value, field) when is_binary(value) do
    if field in @enum_fields and value in @enum_values,
      do: String.to_atom(value),
      else: value
  end

  defp decode_tree_value(value, _field), do: value

  defp decode_tree_key(key) when is_atom(key), do: key

  defp decode_tree_key(key) when is_binary(key) do
    try do
      String.to_existing_atom(key)
    rescue
      ArgumentError -> key
    end
  end

  defp decode_tree_key(key), do: key
end
