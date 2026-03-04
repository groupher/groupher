defmodule Helper.OgInfo do
  @moduledoc false
  import Helper.Utils, only: [done: 1]

  alias Helper.UrlSafety

  @default_site_favicon_adapter Helper.SiteFavicon

  def get(url) do
    adapter = site_favicon_adapter()

    with {:ok, safe_url} <- UrlSafety.validate_http_url(url),
         {:ok, location, resp} <- adapter.find_page(safe_url),
         {:ok, og} <- parse_open_graph(resp.body, safe_url),
         true <- valid_og?(og),
         %URI{host: host} <- URI.parse(safe_url),
         favicon <- adapter.parse_favicon(resp.body, location) do
      og |> Map.merge(%{favicon: favicon}) |> fmt_field(host) |> done
    else
      {:error, reason}
      when reason in [:invalid_url, :invalid_scheme, :missing_host, :blocked_host, :blocked_ip] ->
        {:error, "unsafe url blocked"}

      {:error, :unsafe_url} ->
        {:error, "unsafe url blocked"}

      {:error, %HTTPoison.Error{reason: :nxdomain, id: nil}} ->
        {:error, "get url page error"}

      {:error, %HTTPoison.Error{reason: :timeout, id: nil}} ->
        {:error, "get url page timeout"}

      # {:error, false} ->
      #   {:error,
      #    [message: "only community root can add moderator", code: ecode(:community_root_only)]}
      false ->
        {:error, "invalid open graph info"}

      _ ->
        {:error, "og info parse error"}
    end
  end

  defp parse_open_graph(html, url) do
    og =
      OpenGraph.parse(html)
      |> fmt_og_info(url)

    og =
      case og do
        %{title: nil} -> %{og | title: extract_html_title(html)}
        _ -> og
      end

    og |> done
  end

  defp extract_html_title(html) do
    with {:ok, doc} <- Floki.parse_document(html),
         [title_el | _] <- Floki.find(doc, "title"),
         title <- title_el |> Floki.text() |> String.trim(),
         false <- title == "" do
      title
    else
      _ -> nil
    end
  end

  defp fmt_og_info(%{url: nil} = og, url) do
    %{og | url: url}
  end

  defp fmt_og_info(og, _url), do: og

  defp fmt_field(og, "sspai.com"), do: %{og | site_name: "少数派"}
  defp fmt_field(og, "36kr.com"), do: %{og | site_name: "36kr"}

  defp fmt_field(og, _host), do: og

  defp valid_og?(og) do
    not is_nil(og.title)
  end

  defp site_favicon_adapter do
    Application.get_env(
      :groupher_server,
      :site_favicon_adapter,
      @default_site_favicon_adapter
    )
  end
end
