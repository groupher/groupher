defmodule Helper.ContentThumbnail do
  @moduledoc """
  Compiles a bounded, presentation-neutral thumbnail from a Plate document.

  The result deliberately keeps no editor runtime state or theme values. It is
  persisted only on public ArticleDocuments and rendered with the current site
  tokens by the frontend.

  See `docs/bulk-import/article-publish-import-refactor.md` for ArticleDocument ownership.
  """

  @version 1
  @max_blocks 8
  @max_text_length 180
  @max_list_items 4
  @max_code_lines 6

  @doc "Decodes Plate JSON and returns a bounded presentation-neutral thumbnail."
  @spec compile_json(String.t()) :: map()
  def compile_json(json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, ast} when is_list(ast) -> compile(ast)
      _ -> empty()
    end
  end

  def compile_json(_), do: empty()

  @doc "Compiles a bounded thumbnail from an already-decoded Plate root list."
  @spec compile(list()) :: map()
  def compile(ast) when is_list(ast) do
    blocks =
      ast
      |> Enum.reduce_while([], fn node, acc ->
        case thumbnail_block(node) do
          nil -> {:cont, acc}
          block when length(acc) + 1 >= @max_blocks -> {:halt, [block | acc]}
          block -> {:cont, [block | acc]}
        end
      end)
      |> Enum.reverse()

    %{"version" => @version, "blocks" => blocks}
  end

  def compile(_), do: empty()

  defp empty, do: %{"version" => @version, "blocks" => []}

  defp thumbnail_block(%{"type" => type} = node) when type in ["h1", "h2", "h3"] do
    text = text(node)

    if text == "" do
      nil
    else
      %{
        "type" => "heading",
        "level" => String.to_integer(String.trim_leading(type, "h")),
        "text" => text
      }
    end
  end

  defp thumbnail_block(%{"type" => "callout"} = node), do: text_block("callout", node)

  defp thumbnail_block(%{"listStyleType" => _} = node) do
    items =
      node
      |> list_nodes()
      |> Enum.map(&text/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.take(@max_list_items)

    if items == [], do: nil, else: %{"type" => "list", "items" => items}
  end

  defp thumbnail_block(%{"type" => type} = node)
       when type in ["img", "image", "media_img"] do
    url = Map.get(node, "url") || Map.get(node, "src")

    if is_binary(url) and url != "" do
      %{"type" => "image", "url" => url}
      |> maybe_put_aspect_ratio(node)
    end
  end

  defp thumbnail_block(%{"type" => type} = node)
       when type in ["code", "code_block", "codeblock"] do
    lines =
      node
      |> text()
      |> String.split("\n")
      |> Enum.take(@max_code_lines)

    if lines == [] or lines == [""], do: nil, else: %{"type" => "code", "lines" => lines}
  end

  defp thumbnail_block(%{"type" => type} = node) when type in ["table", "table_row"] do
    rows = Map.get(node, "children", [])
    columns = rows |> List.first(%{}) |> Map.get("children", []) |> length()
    %{"type" => "table", "rows" => length(rows), "columns" => columns}
  end

  defp thumbnail_block(%{"type" => type}) when type in ["video", "embed"] do
    %{"type" => "callout", "text" => if(type == "video", do: "Video", else: "Embedded content")}
  end

  defp thumbnail_block(%{"children" => _} = node), do: text_block("paragraph", node)
  defp thumbnail_block(_), do: nil

  defp text_block(type, node) do
    case text(node) do
      "" -> nil
      value -> %{"type" => type, "text" => value}
    end
  end

  defp text(node) do
    node
    |> flatten_text()
    |> String.trim()
    |> String.slice(0, @max_text_length)
  end

  defp flatten_text(nodes) when is_list(nodes), do: Enum.map_join(nodes, "", &flatten_text/1)
  defp flatten_text(%{"text" => value}) when is_binary(value), do: value

  defp flatten_text(%{"type" => "mention", "value" => value}) when is_binary(value),
    do: "@#{value}"

  defp flatten_text(%{"children" => children}) when is_list(children), do: flatten_text(children)
  defp flatten_text(_), do: ""

  defp list_nodes(%{"children" => children} = node) when is_list(children) do
    if Enum.any?(children, &is_map/1), do: children, else: [node]
  end

  defp list_nodes(node), do: [node]

  defp maybe_put_aspect_ratio(block, %{"width" => width, "height" => height})
       when is_number(width) and is_number(height) and height > 0,
       do: Map.put(block, "aspectRatio", width / height)

  defp maybe_put_aspect_ratio(block, _node), do: block
end
