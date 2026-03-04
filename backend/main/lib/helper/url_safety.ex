defmodule Helper.UrlSafety do
  @moduledoc false

  import Bitwise

  @blocked_hosts MapSet.new([
                   "localhost",
                   "localhost.",
                   "metadata",
                   "metadata.google.internal",
                   "metadata.google.internal."
                 ])

  @spec validate_http_url(String.t()) :: {:ok, String.t()} | {:error, atom()}
  def validate_http_url(url) when is_binary(url) do
    with {:ok, %URI{} = uri} <- parse_url(url),
         :ok <- validate_scheme(uri),
         {:ok, host} <- normalize_host(uri.host),
         :ok <- validate_host(host) do
      {:ok, URI.to_string(%{uri | host: host})}
    end
  end

  def validate_http_url(_), do: {:error, :invalid_url}

  defp parse_url(url) do
    case URI.parse(String.trim(url)) do
      %URI{} = uri -> {:ok, uri}
      _ -> {:error, :invalid_url}
    end
  rescue
    _ -> {:error, :invalid_url}
  end

  defp validate_scheme(%URI{scheme: scheme}) when scheme in ["http", "https"], do: :ok
  defp validate_scheme(_), do: {:error, :invalid_scheme}

  defp normalize_host(nil), do: {:error, :missing_host}

  defp normalize_host(host) do
    host
    |> String.trim()
    |> String.downcase()
    |> case do
      "" -> {:error, :missing_host}
      normalized -> {:ok, normalized}
    end
  end

  defp validate_host(host) do
    cond do
      MapSet.member?(@blocked_hosts, host) ->
        {:error, :blocked_host}

      String.ends_with?(host, ".localhost") ->
        {:error, :blocked_host}

      String.ends_with?(host, ".local") ->
        {:error, :blocked_host}

      true ->
        validate_ip_host(host)
    end
  end

  defp validate_ip_host(host) do
    case :inet.parse_address(String.to_charlist(host)) do
      {:ok, ip} ->
        if blocked_ip?(ip), do: {:error, :blocked_ip}, else: :ok

      {:error, :einval} ->
        :ok
    end
  end

  defp blocked_ip?({127, _, _, _}), do: true
  defp blocked_ip?({10, _, _, _}), do: true
  defp blocked_ip?({192, 168, _, _}), do: true
  defp blocked_ip?({172, second, _, _}) when second in 16..31, do: true
  defp blocked_ip?({169, 254, _, _}), do: true
  defp blocked_ip?({100, second, _, _}) when second in 64..127, do: true
  defp blocked_ip?({0, _, _, _}), do: true
  defp blocked_ip?({255, 255, 255, 255}), do: true
  defp blocked_ip?({0, 0, 0, 0, 0, 0, 0, 1}), do: true
  defp blocked_ip?({0, 0, 0, 0, 0, 0, 0, 0}), do: true

  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFE00) == 0xFC00, do: true
  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFFC0) == 0xFE80, do: true
  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFF00) == 0xFF00, do: true
  defp blocked_ip?(_), do: false
end
