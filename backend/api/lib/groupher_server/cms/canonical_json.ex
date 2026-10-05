defmodule GroupherServer.CMS.CanonicalJSON do
  @moduledoc """
  Encodes protocol payloads with stable object-key ordering.

  This is deliberately narrower than general JSON encoding: callers use it
  only where signatures or digests require byte-for-byte canonical output.

      signature or digest payload
        -> recursively sort object keys
        -> canonical JSON bytes
  """

  @doc "Encodes one JSON-compatible protocol value with recursively stable object-key ordering."
  @spec encode(term()) :: String.t()
  def encode(value) when is_map(value) do
    pairs =
      value
      |> Enum.map(fn {key, item} -> {to_string(key), item} end)
      |> Enum.sort_by(&elem(&1, 0))
      |> Enum.map(fn {key, item} -> Jason.encode!(key) <> ":" <> encode(item) end)

    "{" <> Enum.join(pairs, ",") <> "}"
  end

  def encode(value) when is_list(value) do
    "[" <> (value |> Enum.map(&encode/1) |> Enum.join(",")) <> "]"
  end

  def encode(true), do: "true"
  def encode(false), do: "false"
  def encode(nil), do: "null"
  def encode(value) when is_atom(value), do: encode(Atom.to_string(value))
  def encode(value) when is_binary(value), do: Jason.encode!(value)
  def encode(value) when is_integer(value), do: Integer.to_string(value)
  def encode(value) when is_float(value), do: Jason.encode!(value)
end
