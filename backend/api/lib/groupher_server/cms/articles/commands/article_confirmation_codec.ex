defmodule GroupherServer.CMS.Articles.Commands.ArticleConfirmationCodec do
  @moduledoc """
  Shared strict field helpers for Article Confirmation codecs.

      Article Command
        -> typed Confirmation
        -> strict JSON payload
        -> Receipt recovery
  """

  alias GroupherServer.CMS.Command.Confirmation, as: Codec

  def encode_payload(operation, fields) do
    payload =
      Map.merge(%{"schema_version" => 1, "operation" => Codec.operation_tag(operation)}, fields)

    if Codec.json_safe?(payload), do: {:ok, payload}, else: {:error, :invalid_confirmation}
  end

  def decode_payload(payload, operation, fields) when is_map(payload) do
    with {:ok, :pass} <-
           Codec.strict_keys(payload, ["schema_version", "operation" | Map.keys(fields)]),
         true <- payload["schema_version"] == 1,
         true <- payload["operation"] == Codec.operation_tag(operation),
         {:ok, :pass} <- validate_fields(payload, fields) do
      {:ok, payload}
    else
      _ -> Codec.decode_error()
    end
  end

  def decode_payload(_, _, _), do: Codec.decode_error()

  defp validate_fields(payload, fields) do
    Enum.reduce_while(fields, {:ok, :pass}, fn {key, type}, {:ok, :pass} ->
      if valid_type?(Map.get(payload, key), type) do
        {:cont, {:ok, :pass}}
      else
        {:halt, {:error, key}}
      end
    end)
  end

  defp valid_type?(value, :string), do: is_binary(value) and value != ""
  defp valid_type?(value, :integer), do: is_integer(value)
  defp valid_type?(value, :boolean), do: is_boolean(value)
  defp valid_type?(value, :datetime), do: is_binary(value)

  defp valid_type?(value, {:list, type}) when is_list(value) do
    Enum.all?(value, &valid_type?(&1, type))
  end

  defp valid_type?(_value, _type), do: false
end
