defmodule GroupherServerWeb.Schema.Helper.Metrics do
  @moduledoc """
  Cross-context GraphQL metric objects and the `BigInt` scalar.

  Business position:

      Client
        -> Absinthe schema / Metrics
        -> resolver or domain context
        -> GraphQL response
  """
  import GroupherServerWeb.Schema.Helper.Fields

  use Absinthe.Schema.Notation

  scalar :big_int, name: "BigInt" do
    description("""
    The `BigInt` scalar represents integer values outside GraphQL Int's safe
    transport range. Responses are serialized as strings to avoid precision loss
    in JavaScript clients.
    """)

    serialize(&serialize_big_int/1)
    parse(&parse_big_int/1)
  end

  object :done do
    field(:done, :boolean)
  end

  object :geo_info do
    field(:city, :string)
    field(:value, :integer)
    field(:long, :float)
    field(:lant, :float)
  end

  object :paged_geo_infos do
    field(:entries, list_of(:geo_info))
    pagination_fields()
  end

  input_object :common_paged_filter do
    pagination_args()
    field(:sort, :inserted_sort_enum, default_value: :desc_inserted)
  end

  defp serialize_big_int(nil), do: nil

  defp serialize_big_int(%Decimal{} = value) do
    value
    |> Decimal.to_integer()
    |> Integer.to_string()
  end

  defp serialize_big_int(value) when is_integer(value), do: Integer.to_string(value)
  defp serialize_big_int(value) when is_binary(value), do: value

  defp serialize_big_int(value) do
    raise Absinthe.SerializationError, """
    Value #{inspect(value)} is not a valid BigInt.
    """
  end

  defp parse_big_int(%Absinthe.Blueprint.Input.Integer{value: value}), do: {:ok, value}

  defp parse_big_int(%Absinthe.Blueprint.Input.String{value: value}),
    do: parse_big_int_value(value)

  defp parse_big_int(%Absinthe.Blueprint.Input.Null{}), do: {:ok, nil}
  defp parse_big_int(value) when is_integer(value), do: {:ok, value}
  defp parse_big_int(value) when is_binary(value), do: parse_big_int_value(value)
  defp parse_big_int(_), do: :error

  defp parse_big_int_value(value) do
    case Integer.parse(value) do
      {integer, ""} -> {:ok, integer}
      _ -> :error
    end
  end
end
