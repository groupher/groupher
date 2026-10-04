defmodule GroupherServer.CMS.Command.Confirmation do
  @moduledoc """
  Small shared helper for Confirmation codecs.

  It deliberately does not define a domain result struct. Domain modules keep
  their own Confirmation structs and use these helpers for common strict JSON
  checks.

      Domain Confirmation
        -> strict JSON key/type checks
        -> CMS.Command.Receipt confirmation envelope
        -> decode on an idempotent retry
  """

  @type json_object :: %{required(String.t()) => term()}

  @spec operation_tag(atom()) :: String.t()
  def operation_tag(operation) when is_atom(operation) do
    GroupherServer.CMS.Command.operation_tag(operation)
  end

  @spec required_keys(map(), [String.t()]) :: :ok | {:error, :missing_confirmation_field}
  def required_keys(payload, keys) when is_map(payload) and is_list(keys) do
    if Enum.all?(keys, &Map.has_key?(payload, &1)),
      do: :ok,
      else: {:error, :missing_confirmation_field}
  end

  @spec strict_keys(map(), [String.t()]) :: :ok | {:error, :unknown_confirmation_field}
  def strict_keys(payload, keys) when is_map(payload) and is_list(keys) do
    if Map.keys(payload) |> Enum.sort() == Enum.sort(keys),
      do: :ok,
      else: {:error, :unknown_confirmation_field}
  end

  @spec json_safe?(term()) :: boolean()
  def json_safe?(value) when is_binary(value) or is_number(value) or is_boolean(value), do: true
  def json_safe?(nil), do: true
  def json_safe?(value) when is_list(value), do: Enum.all?(value, &json_safe?/1)

  def json_safe?(value) when is_map(value) and not is_struct(value) do
    Enum.all?(value, fn {key, nested} -> is_binary(key) and json_safe?(nested) end)
  end

  def json_safe?(_), do: false

  @spec valid_data_keys?(map(), nil | [String.t()]) :: boolean()
  def valid_data_keys?(_data, nil), do: true

  def valid_data_keys?(data, keys) when is_map(data) and is_list(keys),
    do: Map.keys(data) |> Enum.sort() == Enum.sort(keys)

  @spec valid_data_schema?(map(), [String.t()] | nil, term()) :: boolean()
  def valid_data_schema?(data, data_keys, field_types)
      when is_map(data) and is_list(data_keys) and is_map(field_types) do
    Enum.sort(Map.keys(field_types)) == Enum.sort(data_keys)
  end

  def valid_data_schema?(_data, _data_keys, _field_types), do: false

  @doc "Validates the declared type of every field in a closed Confirmation payload."
  @spec valid_data_types?(map(), term()) :: boolean()
  def valid_data_types?(data, field_types) when is_map(data) do
    if is_map(field_types) do
      Enum.all?(field_types, fn {key, type} ->
        Map.has_key?(data, key) and valid_type?(Map.fetch!(data, key), type)
      end)
    else
      false
    end
  end

  def valid_type?(value, :string), do: is_binary(value)
  def valid_type?(value, :integer), do: is_integer(value)
  def valid_type?(value, :boolean), do: is_boolean(value)
  def valid_type?(value, :list), do: is_list(value)
  def valid_type?(value, :map), do: is_map(value) and not is_struct(value)
  def valid_type?(value, :json), do: json_safe?(value)

  def valid_type?(value, {:doc_tree_result, variant}) when is_map(value),
    do: GroupherServer.CMS.DocTree.Confirmation.valid_payload?(variant, value)

  def valid_type?(value, {:nullable, type}),
    do: is_nil(value) or valid_type?(value, type)

  def valid_type?(value, {:list, type}) when is_list(value),
    do: Enum.all?(value, &valid_type?(&1, type))

  def valid_type?(_value, {:list, _type}), do: false
  def valid_type?(value, {:one_of, values}), do: value in values
  # The type vocabulary is closed.  A misspelled or unsupported declaration
  # must reject the payload instead of silently turning into a wildcard.
  def valid_type?(_value, _type), do: false

  @spec valid_variant?(map(), nil | String.t(), atom()) :: boolean()
  def valid_variant?(_data, nil, _operation), do: true

  def valid_variant?(data, key, operation)
      when is_map(data) and is_binary(key) and is_atom(operation) do
    expected = operation |> Atom.to_string() |> String.split("_") |> List.last()
    Map.get(data, key) == expected
  end

  @spec decode_error() :: {:error, GroupherServer.CMS.ErrorCat.Error.t()}
  def decode_error, do: {:error, GroupherServer.CMS.ErrorCat.command_result_unavailable()}
end
