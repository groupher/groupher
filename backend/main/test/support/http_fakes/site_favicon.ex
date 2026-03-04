defmodule Helper.TestFakes.SiteFavicon do
  @moduledoc false

  def find_page(url) do
    case URI.parse(url).host do
      "www.ifanr.com" ->
        {:ok, url, %{body: ifanr_html()}}

      "www.apple.com" ->
        {:ok, url, %{body: apple_html()}}

      "36kr.com" ->
        {:ok, url, %{body: kr36_html()}}

      _ ->
        {:error, %HTTPoison.Error{reason: :timeout, id: nil}}
    end
  end

  def parse_favicon(_html, location) do
    uri = URI.parse(location)
    "#{uri.scheme}://#{uri.host}/favicon.ico"
  end

  defp ifanr_html do
    """
    <html>
      <head>
        <title>ifake</title>
        <meta property="og:title" content="Ifanr Story" />
        <meta property="og:site_name" content="ifanr" />
      </head>
      <body></body>
    </html>
    """
  end

  defp apple_html do
    """
    <html>
      <head>
        <meta property="og:title" content="Apple" />
        <meta property="og:site_name" content="Apple" />
      </head>
      <body></body>
    </html>
    """
  end

  defp kr36_html do
    """
    <html>
      <head>
        <meta property="og:title" content="36kr News" />
      </head>
      <body></body>
    </html>
    """
  end
end
