defmodule Helper.Converter.Content.Plate do
  @moduledoc """
  Converts the groupher-editor/Plate AST into persisted document formats.
  """

  @behaviour Helper.Converter.Content

  @impl true
  def convert(ast) when is_list(ast) do
    plain_text =
      ast |> plain_blocks() |> Enum.reject(&(&1 == "")) |> Enum.join("\n") |> String.trim()

    markdown = ast |> markdown_blocks() |> Enum.reject(&(&1 == "")) |> Enum.join("\n\n")
    html = ast |> Enum.map_join("", &block_to_html/1)
    xml = ast |> Enum.map_join("", &block_to_xml/1) |> then(&"<document>#{&1}</document>")

    {:ok,
     %{
       markdown: markdown,
       markdown_toc: markdown_toc(ast),
       html: html,
       xml: xml,
       rss: html,
       plain_text: plain_text
     }}
  end

  def convert(_), do: {:error, :invalid_ast}

  defp markdown_blocks(nodes), do: Enum.map(nodes, &block_to_markdown/1)
  defp plain_blocks(nodes), do: Enum.map(nodes, &block_to_plain/1)

  defp block_to_markdown(%{"type" => type} = node)
       when type in ["h1", "h2", "h3", "h4", "h5", "h6"] do
    level = type |> String.trim_leading("h") |> String.to_integer()
    "#{String.duplicate("#", level)} #{inline_markdown(node)}"
  end

  defp block_to_markdown(%{"type" => "blockquote"} = node), do: "> #{inline_markdown(node)}"

  defp block_to_markdown(%{"type" => "callout"} = node) do
    icon = Map.get(node, "icon", "")
    [icon, inline_markdown(node)] |> Enum.reject(&(&1 == "")) |> Enum.join(" ")
  end

  defp block_to_markdown(%{"type" => "toggle"} = node),
    do: "<details><summary>#{inline_markdown(node)}</summary></details>"

  defp block_to_markdown(%{"listStyleType" => "todo"} = node) do
    checked = if Map.get(node, "checked") == true, do: "x", else: " "
    "#{list_indent(node)}- [#{checked}] #{inline_markdown(node)}"
  end

  defp block_to_markdown(%{"listStyleType" => "decimal"} = node) do
    start = Map.get(node, "listStart", 1)
    "#{list_indent(node)}#{start}. #{inline_markdown(node)}"
  end

  defp block_to_markdown(%{"listStyleType" => _} = node),
    do: "#{list_indent(node)}- #{inline_markdown(node)}"

  defp block_to_markdown(%{"children" => _} = node), do: inline_markdown(node)
  defp block_to_markdown(_), do: ""

  defp block_to_html(%{"type" => type} = node) when type in ["h1", "h2", "h3", "h4", "h5", "h6"],
    do: wrap_html(type, node, inline_html(node))

  defp block_to_html(%{"type" => "blockquote"} = node),
    do: wrap_html("blockquote", node, inline_html(node))

  defp block_to_html(%{"type" => "callout"} = node) do
    icon = node |> Map.get("icon", "") |> escape_html()
    wrap_html("aside", node, "#{icon} #{inline_html(node)}", ~s( class="callout"))
  end

  defp block_to_html(%{"type" => "toggle"} = node) do
    id = html_id_attr(node)
    "<details#{id}><summary>#{inline_html(node)}</summary></details>"
  end

  defp block_to_html(%{"listStyleType" => "todo"} = node) do
    checked = if Map.get(node, "checked") == true, do: ~s( checked="checked"), else: ""

    wrap_html(
      "p",
      node,
      ~s(<input type="checkbox" disabled="disabled"#{checked}> #{inline_html(node)})
    )
  end

  defp block_to_html(%{"children" => _} = node), do: wrap_html("p", node, inline_html(node))
  defp block_to_html(_), do: ""

  defp block_to_xml(%{"children" => _} = node) do
    type = Map.get(node, "type", "p") |> escape_xml()
    id = node_id(node) |> escape_xml()
    attrs = if id == "", do: ~s( type="#{type}"), else: ~s( type="#{type}" id="#{id}")
    "<block#{attrs}>#{inline_xml(node)}</block>"
  end

  defp block_to_xml(_), do: ""

  defp block_to_plain(%{"children" => children}) when is_list(children),
    do: children |> Enum.map_join("", &inline_plain/1) |> String.trim()

  defp block_to_plain(_), do: ""

  defp inline_markdown(%{"children" => children}) when is_list(children),
    do: Enum.map_join(children, "", &inline_markdown/1)

  defp inline_markdown(%{"type" => "mention", "value" => value}) when is_binary(value),
    do: "@#{value}"

  defp inline_markdown(%{"text" => text} = node) when is_binary(text) do
    text
    |> maybe_wrap_mark("**", Map.get(node, "bold") == true)
    |> maybe_wrap_mark("_", Map.get(node, "italic") == true)
    |> maybe_wrap_mark("~~", Map.get(node, "strikethrough") == true)
  end

  defp inline_markdown(_), do: ""

  defp inline_html(%{"children" => children}) when is_list(children),
    do: Enum.map_join(children, "", &inline_html/1)

  defp inline_html(%{"type" => "mention", "value" => value}) when is_binary(value) do
    escaped = escape_html(value)
    ~s(<span data-mention="#{escaped}">@#{escaped}</span>)
  end

  defp inline_html(%{"text" => text} = node) when is_binary(text) do
    text
    |> escape_html()
    |> maybe_wrap_html("strong", Map.get(node, "bold") == true)
    |> maybe_wrap_html("em", Map.get(node, "italic") == true)
    |> maybe_wrap_html("s", Map.get(node, "strikethrough") == true)
  end

  defp inline_html(_), do: ""

  defp inline_xml(%{"children" => children}) when is_list(children),
    do: Enum.map_join(children, "", &inline_xml/1)

  defp inline_xml(%{"type" => "mention", "value" => value}) when is_binary(value),
    do: ~s(<mention value="#{escape_xml(value)}">@#{escape_xml(value)}</mention>)

  defp inline_xml(%{"text" => text} = node) when is_binary(text) do
    attrs =
      [
        {"bold", Map.get(node, "bold")},
        {"italic", Map.get(node, "italic")},
        {"strikethrough", Map.get(node, "strikethrough")}
      ]
      |> Enum.filter(fn {_key, value} -> value == true end)
      |> Enum.map_join("", fn {key, _value} -> ~s( #{key}="true") end)

    "<text#{attrs}>#{escape_xml(text)}</text>"
  end

  defp inline_xml(_), do: ""

  defp inline_plain(%{"type" => "mention", "value" => value}) when is_binary(value), do: value
  defp inline_plain(%{"text" => text}) when is_binary(text), do: text

  defp inline_plain(%{"children" => children}) when is_list(children),
    do: Enum.map_join(children, "", &inline_plain/1)

  defp inline_plain(_), do: ""

  defp markdown_toc(ast) do
    items =
      ast
      |> Enum.filter(&(Map.get(&1, "type") in ["h1", "h2", "h3", "h4", "h5", "h6"]))
      |> Enum.map(fn node ->
        %{
          id: node_id(node),
          level: node |> Map.get("type") |> String.trim_leading("h") |> String.to_integer(),
          text: block_to_plain(node)
        }
      end)

    %{items: items}
  end

  defp wrap_html(tag, node, content, extra_attrs \\ "") do
    "<#{tag}#{html_id_attr(node)}#{extra_attrs}>#{content}</#{tag}>"
  end

  defp html_id_attr(node) do
    case node_id(node) do
      "" -> ""
      id -> ~s( id="#{escape_html(id)}")
    end
  end

  defp node_id(%{"id" => id}) when is_binary(id), do: id
  defp node_id(%{"_id" => id}) when is_binary(id), do: id
  defp node_id(_), do: ""

  defp list_indent(node), do: String.duplicate("  ", max(Map.get(node, "indent", 1) - 1, 0))

  defp maybe_wrap_mark(text, _mark, false), do: text
  defp maybe_wrap_mark(text, mark, true), do: "#{mark}#{text}#{mark}"

  defp maybe_wrap_html(text, _tag, false), do: text
  defp maybe_wrap_html(text, tag, true), do: "<#{tag}>#{text}</#{tag}>"

  defp escape_html(text) when is_binary(text) do
    text
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end

  defp escape_xml(text) when is_binary(text), do: escape_html(text)
end
