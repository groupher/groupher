defmodule GroupherServer.CMS.DocTree.Confirmation do
  @moduledoc """
  Strict typed payload validation for DocTree Confirmation variants.

      DocTree command action
          -> typed variant payload
          -> Confirmation codec
          -> Receipt persistence / recovery

  The outer Confirmation envelope is shared, but `result_payload` is no
  longer treated as arbitrary JSON. Each DocTree operation chooses one of the
  closed payload variants (`:tree` or `:subtree`) with an explicit key set.
  """

  @tree_keys ~w(schema_version revision tree_state node affected_nodes conflict)
  @subtree_keys ~w(schema_version done affected_count)

  @doc "Validates one nested DocTree result variant with a closed key set."
  @spec valid_payload?(atom(), map()) :: boolean()
  def valid_payload?(:tree, payload) when is_map(payload) do
    Map.keys(payload) |> Enum.sort() == Enum.sort(@tree_keys) and
      payload["schema_version"] == 1 and
      is_integer(payload["revision"]) and
      json_map?(payload["tree_state"]) and
      nullable_json_map?(payload["node"]) and
      is_list(payload["affected_nodes"]) and
      Enum.all?(payload["affected_nodes"], &json_value?/1) and
      is_boolean(payload["conflict"])
  end

  def valid_payload?(:subtree, payload) when is_map(payload) do
    Map.keys(payload) |> Enum.sort() == Enum.sort(@subtree_keys) and
      payload["schema_version"] == 1 and
      is_boolean(payload["done"]) and
      is_integer(payload["affected_count"])
  end

  def valid_payload?(_variant, _payload), do: false

  defp nullable_json_map?(nil), do: true
  defp nullable_json_map?(value), do: json_map?(value)

  defp json_map?(value) when is_map(value) do
    Enum.all?(value, fn {key, item} -> is_binary(key) and json_value?(item) end)
  end

  defp json_map?(_value), do: false

  defp json_value?(nil), do: true
  defp json_value?(value) when is_binary(value) or is_number(value) or is_boolean(value), do: true
  defp json_value?(value) when is_list(value), do: Enum.all?(value, &json_value?/1)
  defp json_value?(value) when is_map(value), do: json_map?(value)
  defp json_value?(_value), do: false
end
