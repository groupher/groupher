defmodule GroupherServer.CMS.Command.ConfirmationDefinition do
  @moduledoc """
  Supplies the strict JSON envelope shared by small domain Confirmation codecs.

      domain operation
        -> explicit Confirmation module
        -> string-key JSON envelope
        -> CMS.Command.Receipt recovery
  """

  defmacro __using__(opts) do
    operation = Keyword.fetch!(opts, :operation)
    operations = Keyword.get(opts, :operations, [operation])
    data_keys = Keyword.get(opts, :data_keys)
    field_types = Keyword.get(opts, :field_types, %{})
    variant_key = Keyword.get(opts, :variant_key)
    schema_version = Keyword.get(opts, :schema_version, 1)
    supported_schema_versions = Keyword.get(opts, :supported_schema_versions, [schema_version])
    fields = ["schema_version", "operation", "data"]

    quote do
      @behaviour GroupherServer.CMS.Command.ConfirmationCodec
      alias GroupherServer.CMS.Command.Confirmation, as: Codec
      @schema_version unquote(schema_version)
      @supported_schema_versions unquote(supported_schema_versions)
      @confirmation_fields unquote(fields)
      @operation unquote(operation)
      @operations unquote(operations)
      @data_keys unquote(data_keys)
      @field_types unquote(field_types)
      @variant_key unquote(variant_key)
      defstruct [:data]

      @impl true
      def operations, do: @operations

      @impl true
      def encode(%__MODULE__{data: data}, operation)
          when operation in @operations and is_map(data) do
        payload = %{
          "schema_version" => @schema_version,
          "operation" => Codec.operation_tag(operation),
          "data" => data
        }

        if Codec.json_safe?(payload) and Codec.valid_data_keys?(data, @data_keys) and
             Codec.valid_data_schema?(data, @data_keys, @field_types) and
             Codec.valid_data_types?(data, @field_types) and
             Codec.valid_variant?(data, @variant_key, operation),
           do: {:ok, payload},
           else: {:error, :invalid_confirmation}
      end

      def encode(_value, _operation), do: {:error, :confirmation_mismatch}

      @impl true
      def decode(payload, operation) when operation in @operations and is_map(payload) do
        with {:ok, :pass} <- Codec.strict_keys(payload, @confirmation_fields),
             true <- payload["schema_version"] in @supported_schema_versions,
             true <- payload["operation"] == Codec.operation_tag(operation),
             data when is_map(data) <- payload["data"],
             true <- Codec.json_safe?(data),
             true <- Codec.valid_data_keys?(data, @data_keys),
             true <- Codec.valid_data_schema?(data, @data_keys, @field_types),
             true <- Codec.valid_data_types?(data, @field_types),
             true <- Codec.valid_variant?(data, @variant_key, operation) do
          {:ok, %__MODULE__{data: data}}
        else
          _ -> Codec.decode_error()
        end
      end

      def decode(_payload, _operation), do: Codec.decode_error()
    end
  end
end
