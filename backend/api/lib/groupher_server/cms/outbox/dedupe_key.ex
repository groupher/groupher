defmodule GroupherServer.CMS.Outbox.DedupeKey do
  @moduledoc """
  Encodes owner-selected Outbox dedupe dimensions without ambiguous separators.

  The caller must provide a fixed-order list of business fields. The encoder
  tags every value type and length-prefixes every encoded value before hashing.

      domain effect dimensions -> typed canonical bytes -> stable SHA-256 key
      Outbox unique key -> first event provenance retained
  """

  @doc "Builds a stable key from an explicitly ordered list of business dimensions."
  @spec encode([term()]) :: String.t()
  def encode(parts) when is_list(parts) do
    encoded =
      IO.iodata_to_binary(["v1", encode_value(length(parts)), Enum.map(parts, &encode_value/1)])

    "v1:" <> Base.encode16(:crypto.hash(:sha256, encoded), case: :lower)
  end

  defp encode_value(nil), do: "n"
  defp encode_value(true), do: "b1"
  defp encode_value(false), do: "b0"
  defp encode_value(value) when is_atom(value), do: encode_bytes("a", Atom.to_string(value))
  defp encode_value(value) when is_binary(value), do: encode_bytes("s", value)
  defp encode_value(value) when is_integer(value), do: encode_bytes("i", Integer.to_string(value))

  defp encode_value(values) when is_list(values) do
    body = Enum.map(values, &encode_value/1)
    ["l", encode_value(length(values)), body]
  end

  defp encode_value(_value), do: raise(ArgumentError, "unsupported Outbox dedupe dimension")

  defp encode_bytes(type, value), do: [type, Integer.to_string(byte_size(value)), ":", value]
end
