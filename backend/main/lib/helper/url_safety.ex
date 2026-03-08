defmodule Helper.UrlSafety do
  @moduledoc """
  URL safety validation to prevent SSRF attacks.

  Validates that URLs:
  - Use http or https scheme
  - Do not resolve to private/internal IP ranges
  - Do not use blocked hostnames (localhost, metadata services, etc.)

  This module is used by HTTP client adapters (SiteFavicon, OgInfo) to validate
  URLs before making outgoing requests.
  """

  import Bitwise

  @blocked_hosts MapSet.new([
                   "localhost",
                   "localhost.",
                   "metadata",
                   "metadata.google.internal",
                   "metadata.google.internal."
                 ])

  @default_resolve_timeout 5_000

  @doc """
  Validates a URL for safe HTTP requests.

  Returns `{:ok, normalized_url}` if safe, `{:error, reason}` otherwise.

  ## Options
    - `:timeout` - DNS lookup timeout in milliseconds (default: 5000)

  ## Examples
      iex> UrlSafety.validate_http_url("https://example.com/page")
      {:ok, "https://example.com/page"}

      iex> UrlSafety.validate_http_url("http://127.0.0.1/admin")
      {:error, :blocked_ip}

      iex> UrlSafety.validate_http_url("http://localhost:8080")
      {:error, :blocked_host}
  """
  @spec validate_http_url(String.t(), keyword()) :: {:ok, String.t()} | {:error, atom()}
  def validate_http_url(url, opts \\ [])

  def validate_http_url(url, opts) when is_binary(url) do
    timeout = Keyword.get(opts, :timeout, @default_resolve_timeout)

    with {:ok, %URI{} = uri} <- parse_url(url),
         :ok <- validate_scheme(uri),
         {:ok, host} <- normalize_host(uri.host),
         :ok <- validate_host(host),
         :ok <- validate_resolved_ips(host, timeout) do
      {:ok, URI.to_string(%{uri | host: host})}
    end
  end

  def validate_http_url(_, _), do: {:error, :invalid_url}

  defp parse_url(url) do
    case URI.new(String.trim(url)) do
      {:ok, %URI{} = uri} -> {:ok, uri}
      {:error, _} -> {:error, :invalid_url}
    end
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

  defp validate_resolved_ips(host, timeout) do
    case resolve_host_ips(host, timeout) do
      {:ok, ips} when ips != [] ->
        blocked_ips = Enum.filter(ips, &blocked_ip?/1)

        if blocked_ips != [] do
          {:error, :blocked_ip}
        else
          :ok
        end

      _ ->
        :ok
    end
  end

  defp resolve_host_ips(host, timeout) do
    try do
      case :inet.gethostbyname(String.to_charlist(host), :inet, timeout) do
        {:ok, hostent} -> {:ok, extract_ips(hostent)}
        {:error, reason} -> {:error, reason}
      end
    rescue
      _ -> {:error, :resolve_failed}
    catch
      :exit, _ -> {:error, :resolve_failed}
      _ -> {:error, :resolve_failed}
    end
  end

  defp extract_ips({:hostent, _, _, _, _, ips}) do
    ips
  rescue
    _ -> []
  end

  # IPv4 private ranges
  # 127.0.0.0/8 (loopback)
  defp blocked_ip?({127, _, _, _}), do: true
  # 10.0.0.0/8
  defp blocked_ip?({10, _, _, _}), do: true
  # 192.168.0.0/16
  defp blocked_ip?({192, 168, _, _}), do: true
  # 172.16.0.0/12
  defp blocked_ip?({172, second, _, _}) when second in 16..31, do: true
  # 169.254.0.0/16 (link-local)
  defp blocked_ip?({169, 254, _, _}), do: true
  # 100.64.0.0/10 (CGNAT)
  defp blocked_ip?({100, second, _, _}) when second in 64..127, do: true
  # 0.0.0.0/8
  defp blocked_ip?({0, _, _, _}), do: true
  # broadcast
  defp blocked_ip?({255, 255, 255, 255}), do: true

  # IPv6 loopback and unspecified
  # ::1 (loopback)
  defp blocked_ip?({0, 0, 0, 0, 0, 0, 0, 1}), do: true
  # :: (unspecified)
  defp blocked_ip?({0, 0, 0, 0, 0, 0, 0, 0}), do: true

  # IPv6 unique local addresses (ULA) - fc00::/7
  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFE00) == 0xFC00, do: true

  # IPv6 link-local fe80::/10
  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFFC0) == 0xFE80, do: true

  # IPv6 multicast ff00::/8
  defp blocked_ip?({a, _, _, _, _, _, _, _}) when (a &&& 0xFF00) == 0xFF00, do: true

  # IPv4-mapped IPv6 addresses: ::ffff:0:0/96
  # Format: {0, 0, 0, 0, 0, 0xFFFF, a, b} where a and b are 16-bit values
  # Example: ::ffff:127.0.0.1 = {0, 0, 0, 0, 0, 0xFFFF, 32256, 1} (32256 = 0x7F00)
  defp blocked_ip?({0, 0, 0, 0, 0, 0xFFFF, a, b}) do
    ip1 = a >>> 8
    ip2 = a &&& 0xFF
    ip3 = b >>> 8
    ip4 = b &&& 0xFF
    blocked_ip?({ip1, ip2, ip3, ip4})
  end

  defp blocked_ip?(_), do: false
end
