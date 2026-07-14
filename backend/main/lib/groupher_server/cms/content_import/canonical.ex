defmodule GroupherServer.CMS.ContentImport.Canonical do
  @moduledoc false

  @volatile_metadata_keys MapSet.new(~w(
    authorization
    credential
    credentials
    fetched_at
    fetchedAt
    request_id
    requestId
    signed_url
    signedUrl
    staging_ref
    stagingRef
    token
  ))

  @spec sha256(term()) :: String.t()
  def sha256(value) do
    value
    |> canonical_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  @spec canonical_binary(term()) :: binary()
  def canonical_binary(value) do
    value
    |> canonicalize()
    |> :erlang.term_to_binary([:deterministic])
  end

  @spec normalize_text_body(binary()) :: binary()
  def normalize_text_body(value) when is_binary(value) do
    value
    |> normalize_line_endings()
    |> String.trim_trailing("\n")
    |> Kernel.<>("\n")
  end

  @spec normalize_line_endings(binary()) :: binary()
  def normalize_line_endings(value) when is_binary(value) do
    if String.valid?(value) do
      value
      |> String.replace("\r\n", "\n")
      |> String.replace("\r", "\n")
    else
      value
    end
  end

  @spec normalize_path(String.t() | nil) :: String.t() | nil
  def normalize_path(nil), do: nil
  def normalize_path(path) when is_binary(path), do: String.replace(path, "\\", "/")

  @spec effective_metadata(map()) :: map()
  def effective_metadata(metadata) when is_map(metadata) do
    metadata
    |> Enum.reject(fn {key, _value} -> volatile_metadata_key?(key) end)
    |> Map.new(fn {key, value} -> {key, normalize_metadata_value(value)} end)
  end

  defp normalize_metadata_value(value) when is_map(value), do: effective_metadata(value)

  defp normalize_metadata_value(value) when is_list(value),
    do: Enum.map(value, &normalize_metadata_value/1)

  defp normalize_metadata_value(value), do: value

  defp volatile_metadata_key?(key) when is_atom(key),
    do: volatile_metadata_key?(Atom.to_string(key))

  defp volatile_metadata_key?(key) when is_binary(key),
    do: MapSet.member?(@volatile_metadata_keys, key)

  defp volatile_metadata_key?(_key), do: false

  defp canonicalize({:raw_binary, value}) when is_binary(value), do: {:raw_binary, value}

  defp canonicalize({:text_body, value}) when is_binary(value),
    do: {:text_body, normalize_text_body(value)}

  defp canonicalize(%DateTime{} = value), do: {:datetime, DateTime.to_iso8601(value)}

  defp canonicalize(%NaiveDateTime{} = value),
    do: {:naive_datetime, NaiveDateTime.to_iso8601(value)}

  defp canonicalize(%Date{} = value), do: {:date, Date.to_iso8601(value)}
  defp canonicalize(%Time{} = value), do: {:time, Time.to_iso8601(value)}

  defp canonicalize(value) when is_map(value) do
    entries =
      value
      |> Enum.map(fn {key, nested} -> {canonical_key(key), canonicalize(nested)} end)
      |> Enum.sort_by(&elem(&1, 0))

    {:map, entries}
  end

  defp canonicalize(value) when is_list(value), do: {:list, Enum.map(value, &canonicalize/1)}

  defp canonicalize(value) when is_tuple(value) do
    {:tuple, value |> Tuple.to_list() |> Enum.map(&canonicalize/1)}
  end

  defp canonicalize(value) when is_binary(value) do
    if String.valid?(value),
      do: {:string, normalize_line_endings(value)},
      else: {:binary, value}
  end

  defp canonicalize(value)
       when is_atom(value) or is_integer(value) or is_float(value) or is_nil(value),
       do: value

  defp canonicalize(value) do
    raise ArgumentError, "unsupported canonical value: #{inspect(value)}"
  end

  defp canonical_key(key) when is_binary(key), do: key
  defp canonical_key(key) when is_atom(key), do: Atom.to_string(key)
  defp canonical_key(key) when is_integer(key), do: Integer.to_string(key)

  defp canonical_key(key) do
    raise ArgumentError, "unsupported canonical map key: #{inspect(key)}"
  end
end
