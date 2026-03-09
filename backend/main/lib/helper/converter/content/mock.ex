defmodule Helper.Converter.Content.Mock do
  @moduledoc """
  Minimal mock converter for pipeline integration tests.
  """

  @behaviour Helper.Converter.Content

  @impl true
  def convert(ast) when is_list(ast) do
    plain_text = extract_plain_text(ast) |> String.trim()
    markdown = if plain_text == "", do: "", else: plain_text
    html = if plain_text == "", do: "", else: "<p>#{escape_html(plain_text)}</p>"

    {:ok,
     %{
       markdown: markdown,
       markdown_toc: %{items: []},
       html: html,
       rss: html,
       plain_text: plain_text
     }}
  end

  def convert(_), do: {:error, :invalid_ast}

  defp extract_plain_text(nodes) when is_list(nodes) do
    nodes
    |> Enum.map(&extract_plain_text/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" ")
  end

  defp extract_plain_text(%{"text" => text}) when is_binary(text), do: text

  defp extract_plain_text(%{"value" => value, "type" => "mention"}) when is_binary(value),
    do: value

  defp extract_plain_text(%{"children" => children}) when is_list(children),
    do: extract_plain_text(children)

  defp extract_plain_text(_), do: ""

  defp escape_html(text) when is_binary(text) do
    text
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end
end
