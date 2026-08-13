defmodule Helper.SiteFavicon do
  @moduledoc """
  Discovers a site's favicon through an SSRF-safe, bounded fetch pipeline.

  The implementation originated from `exfavicon` but now validates target and
  redirect URLs, limits response work, and accepts only supported icon results.
  fix edge case at line:60

  Business position:

      Domain or web caller
        -> SiteFavicon
        -> normalized value / infrastructure
  """
  alias Helper.UrlSafety

  @doc "Finds page through the `SiteFavicon` boundary."
  def find_page(url) do
    with {:ok, safe_url} <- UrlSafety.validate_http_url(url) do
      req(safe_url)
    end
  end

  @doc "Parses favicon into the canonical `SiteFavicon` representation."
  def parse_favicon(html, location) do
    icon_url = find_from_html(html, location)
    if icon_url, do: icon_url, else: default_path(location)
  end

  @doc "Runs `find` through the public `SiteFavicon` boundary."
  def find(url) do
    {:ok, location, resp} = req(url)

    icon_url = find_from_html(resp.body, location)
    if icon_url, do: icon_url, else: default_path(location)
  end

  @doc "Finds from html through the `SiteFavicon` boundary."
  def find_from_html(html, url) do
    case detect(html, url) do
      {:ok, icon_url} ->
        if valid_favicon_url?(icon_url), do: icon_url, else: nil

      _ ->
        nil
    end
  end

  @doc "Reports whether favicon url? according to `SiteFavicon`."
  def valid_favicon_url?(url) do
    with {:ok, safe_url} <- UrlSafety.validate_http_url(url),
         {:ok, resp} <- head(safe_url) do
      ctype =
        resp.headers
        |> get_header("content-type")

      Regex.match?(~r/image/, ctype)
    else
      _ -> false
    end
  end

  defp req(url) do
    with {:ok, resp} <- get(url) do
      headers =
        resp.headers
        |> normalize_headers()

      case List.keyfind(headers, "location", 0) do
        {"location", location} ->
          merged_location = merge_location(url, header_value(location))

          with {:ok, safe_location} <- UrlSafety.validate_http_url(merged_location) do
            req(safe_location)
          else
            _ -> {:error, :unsafe_url}
          end

        _ ->
          {:ok, url, resp}
      end
    end
  end

  defp get(url), do: Req.get(url, redirect: false, receive_timeout: 10_000)
  defp head(url), do: Req.head(url, redirect: false, receive_timeout: 10_000)

  defp merge_location(base_url, location) do
    base_uri = URI.parse(base_url)

    location_uri = URI.parse(location)

    if is_nil(location_uri.scheme) and is_nil(location_uri.host) do
      merged = URI.merge(base_uri, location_uri)
      URI.to_string(merged)
    else
      location
    end
  rescue
    _ -> location
  end

  defp detect(html, url) do
    {:ok, ptn} = Regex.compile("^(shortcut )?icon$", "i")

    favicon_url_or_path =
      html
      |> Floki.find("link")
      |> Enum.filter(&Regex.match?(ptn, List.first(Floki.attribute(&1, "rel")) || ""))
      |> Enum.flat_map(&Floki.attribute(&1, "href"))
      |> List.first()

    case favicon_url_or_path do
      "" ->
        {:error, "blank"}

      nil ->
        {:error, "blank"}

      _ ->
        case Regex.match?(~r/^https?/, favicon_url_or_path) do
          true ->
            {:ok, favicon_url_or_path}

          false ->
            uri = URI.parse(favicon_url_or_path)

            case uri do
              %URI{host: nil} ->
                {:ok, %{URI.parse(url) | path: uri.path} |> URI.to_string()}

              %URI{scheme: nil} ->
                {:ok, %{uri | scheme: "http"} |> URI.to_string()}

              _ ->
                {:error, "unknown uri"}
            end
        end
    end
  end

  defp get_header(headers, key) do
    ctype =
      headers
      |> normalize_headers()
      |> Enum.filter(fn {k, _} -> k == key |> String.downcase() end)

    case ctype do
      [] ->
        ""

      _ ->
        ctype |> hd |> elem(1) |> header_value()
    end
  end

  defp normalize_headers(headers) when is_map(headers) do
    Enum.map(headers, fn {k, v} -> {String.downcase(to_string(k)), v} end)
  end

  defp normalize_headers(headers) when is_list(headers) do
    Enum.map(headers, fn {k, v} -> {String.downcase(to_string(k)), v} end)
  end

  defp header_value([value | _]), do: value
  defp header_value(value), do: value

  defp default_path(url) do
    %{URI.parse(url) | path: "/favicon.ico", query: nil, fragment: nil}
    |> URI.to_string()
  end
end
