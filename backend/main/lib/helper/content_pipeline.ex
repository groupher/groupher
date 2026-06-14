defmodule Helper.ContentPipeline do
  @moduledoc """
  Parse and enrich canonical body payload once.
  """

  import Helper.Utils, only: [done: 1, get_config: 2]

  alias Helper.{ContentPayload, Converter.Content}

  @digest_length get_config(:article, :digest_length)
  @type t :: ContentPayload.t()

  @doc """
  Parses a `body` JSON string and returns a normalized content payload.

  Accepts Plate AST JSON only (array root).

  ## Examples

      iex> body = Jason.encode!([
      ...>   %{"type" => "h1", "children" => [%{"text" => "Hello"}]},
      ...>   %{"type" => "p", "children" => [%{"text" => "Visit https://groupher.com"}]}
      ...> ])
      iex> {:ok, payload} = Helper.ContentPipeline.parse(%{body: body})
      iex> payload.schema_version
      1
      iex> is_binary(payload.html)
      true
      iex> payload.mentions
      []
  """
  @spec parse(map()) :: {:ok, t()} | {:error, term()}
  def parse(%{body: body}) when is_binary(body) do
    with {:ok, ast} <- decode_ast(body),
         {:ok, converted} <- Content.convert(ast) do
      plain_text = pick_plain_text(converted, ast)

      %{
        json: body,
        markdown: Map.get(converted, :markdown, ""),
        markdown_toc: Map.get(converted, :markdown_toc, %{}),
        html: Map.get(converted, :html, ""),
        xml: Map.get(converted, :xml, ""),
        rss: Map.get(converted, :rss, ""),
        plain_text: plain_text,
        digest: plain_text |> String.slice(0, @digest_length),
        content_hash: content_hash(body),
        schema_version: 1,
        ast: ast,
        mentions: extract_mentions(ast)
      }
      |> done()
    end
  end

  def parse(_), do: {:error, :invalid_body}

  @doc """
  Creates a minimal Plate paragraph from plain text readme,
  then delegates to `parse/1`.

  ## Examples

      iex> {:ok, payload} = Helper.ContentPipeline.from_readme("Hello Groupher")
      iex> payload.plain_text
      "Hello Groupher"
      iex> payload.schema_version
      1
  """
  @spec from_readme(String.t()) :: {:ok, t()} | {:error, term()}
  def from_readme(readme) when is_binary(readme) do
    [
      %{
        "type" => "p",
        "children" => [%{"text" => readme}]
      }
    ]
    |> Jason.encode!()
    |> then(&parse(%{body: &1}))
  end

  def from_readme(_), do: {:error, :invalid_readme}

  @doc """
  Decodes body JSON into normalized AST only.

  Unlike `parse/1`, this does not run converter or enrichment.

  ## Examples

      iex> body = Jason.encode!([%{"type" => "p", "children" => [%{"text" => "Hi"}]}])
      iex> {:ok, ast} = Helper.ContentPipeline.decode(body)
      iex> is_list(ast)
      true
  """
  @spec decode(String.t()) :: {:ok, list()} | {:error, term()}
  def decode(body) when is_binary(body), do: decode_ast(body)
  def decode(_), do: {:error, :invalid_body}

  # Decode JSON body and normalize it into accepted AST shape.
  defp decode_ast(body) when is_binary(body) do
    with {:ok, decoded} <- Jason.decode(body) do
      normalize_decoded_ast(decoded)
    end
  end

  # Accept only Plate AST root list.
  defp normalize_decoded_ast(ast) when is_list(ast), do: {:ok, ast}

  # Reject non-Plate JSON payloads.
  defp normalize_decoded_ast(_), do: {:error, :invalid_plate_json}

  # Prefer converter-provided plain_text when available.
  defp pick_plain_text(%{plain_text: plain_text}, _ast) when is_binary(plain_text), do: plain_text

  # Fallback to AST flattening when converter does not provide plain_text.
  defp pick_plain_text(_converted, ast), do: ast |> flatten_text() |> String.trim()

  # Flatten nested AST nodes into a plain text sentence.
  defp flatten_text(nodes) when is_list(nodes) do
    nodes
    |> Enum.map(&flatten_text/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" ")
  end

  # Extract text leaf content.
  defp flatten_text(%{"text" => text}) when is_binary(text), do: text

  # Treat mention value as readable plain text.
  defp flatten_text(%{"type" => "mention", "value" => value}) when is_binary(value), do: value

  # Recurse into nested children nodes.
  defp flatten_text(%{"children" => children}) when is_list(children), do: flatten_text(children)

  # Ignore unsupported node shapes.
  defp flatten_text(_), do: ""

  # Public mention extraction entry from AST list.
  defp extract_mentions(nodes) when is_list(nodes),
    do: do_extract_mentions(nodes, []) |> Enum.reverse() |> Enum.uniq()

  # Finish traversal; ordering/deduplication happens at the public entry.
  defp do_extract_mentions([], acc), do: acc

  # Collect mention values from mention nodes.
  defp do_extract_mentions([%{"type" => "mention", "value" => value} = node | rest], acc)
       when is_binary(value) do
    acc = [value | acc]
    acc = acc_from_children(node, acc, &do_extract_mentions/2)
    do_extract_mentions(rest, acc)
  end

  # Recurse into generic map nodes via children.
  defp do_extract_mentions([node | rest], acc) when is_map(node) do
    acc = acc_from_children(node, acc, &do_extract_mentions/2)
    do_extract_mentions(rest, acc)
  end

  # Skip unsupported node entries.
  defp do_extract_mentions([_ | rest], acc), do: do_extract_mentions(rest, acc)

  # Reuse extractor against node children when present.
  defp acc_from_children(%{"children" => children}, acc, extractor) when is_list(children),
    do: extractor.(children, acc)

  # Keep accumulator unchanged for nodes without children.
  defp acc_from_children(_, acc, _extractor), do: acc

  # Build deterministic SHA256 hash from raw body JSON.
  defp content_hash(body) do
    :sha256
    |> :crypto.hash(body)
    |> Base.encode16(case: :lower)
  end
end
