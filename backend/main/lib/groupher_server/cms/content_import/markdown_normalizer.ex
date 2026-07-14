defmodule GroupherServer.CMS.ContentImport.MarkdownNormalizer do
  @moduledoc """
  Projects an immutable Markdown/MDX Entry into Groupher's shared Plate body contract.

  Resource references are discovered while converting the body, but this
  module never downloads or writes them. The Plate body contains stable
  `content-import://asset/...` placeholders until apply resolves staged assets.
  """

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic, Entry, Snapshot}
  alias GroupherServer.CMS.ContentImport.Plan.Asset
  alias Helper.ContentPipeline

  @schema_version 1
  @placeholder_prefix "content-import://asset/"
  @heading_types ~w(h1 h2 h3 h4 h5 h6)

  @type result :: %{
          required(:content) => map(),
          required(:assets) => [Asset.t()],
          required(:diagnostics) => [Diagnostic.t()]
        }

  @spec schema_version() :: pos_integer()
  def schema_version, do: @schema_version

  @spec normalize(Entry.t(), Snapshot.t(), keyword()) ::
          {:ok, result()} | {:error, [Diagnostic.t()]}
  def normalize(%Entry{} = entry, %Snapshot{} = snapshot, opts \\ []) do
    with {:ok, markdown} <- markdown_body(entry),
         {:ok, markdown_ast, parser_messages} <-
           Earmark.Parser.as_ast(strip_frontmatter(markdown)) do
      state = %{
        entry: entry,
        entries_by_ref: Map.new(snapshot.entries, &{&1.external_ref, &1}),
        assets: %{},
        asset_keys: [],
        link_resolver: Keyword.get(opts, :link_resolver),
        diagnostics: parser_diagnostics(parser_messages, entry)
      }

      {plate_ast, state} = convert_blocks(markdown_ast, state)
      body = Jason.encode!(plate_ast)

      case ContentPipeline.parse(%{body: body}) do
        {:ok, payload} ->
          {:ok,
           %{
             content: %{
               "status" => "normalized",
               "schemaVersion" => @schema_version,
               "sourceFormat" => source_format(entry),
               "body" => payload.json,
               "contentHash" => payload.content_hash,
               "plainText" => payload.plain_text,
               "assetKeys" => Enum.reverse(state.asset_keys)
             },
             assets: state.assets |> Map.values() |> Enum.sort_by(& &1.asset_key),
             diagnostics: Enum.reverse(state.diagnostics)
           }}

        {:error, reason} ->
          {:error,
           [
             Diagnostic.error(
               "markdown_content_pipeline_failed",
               "normalized Markdown content was rejected by the content pipeline",
               file: entry.path,
               source_id: entry.external_ref,
               details: inspect(reason)
             )
           ]}
      end
    else
      {:error, diagnostics} when is_list(diagnostics) ->
        {:error, diagnostics}

      {:error, reason, parser_messages} ->
        {:error,
         [
           Diagnostic.error(
             "markdown_parse_failed",
             "could not parse the Markdown source body",
             file: entry.path,
             source_id: entry.external_ref,
             details: %{reason: inspect(reason), messages: parser_messages}
           )
         ]}
    end
  end

  defp markdown_body(%Entry{body: body} = entry) when is_binary(body) do
    if source_format(entry) in ["markdown", "mdx"] do
      {:ok, body}
    else
      {:error,
       [
         Diagnostic.error(
           "unsupported_markdown_body_format",
           "source body must be Markdown or MDX",
           file: entry.path,
           source_id: entry.external_ref
         )
       ]}
    end
  end

  defp markdown_body(%Entry{} = entry) do
    {:error,
     [
       Diagnostic.error(
         "markdown_body_missing",
         "source Entry does not contain a text body",
         file: entry.path,
         source_id: entry.external_ref
       )
     ]}
  end

  defp source_format(%Entry{body_format: :mdx}), do: "mdx"
  defp source_format(%Entry{body_format: :md}), do: "markdown"

  defp source_format(%Entry{path: path}) when is_binary(path) do
    if String.downcase(Path.extname(path)) == ".mdx", do: "mdx", else: "markdown"
  end

  defp source_format(_entry), do: "unknown"

  defp strip_frontmatter(markdown) do
    case Regex.run(~r/\A---\s*\n.*?\n---\s*(?:\n|\z)/s, markdown) do
      [frontmatter] -> String.replace_prefix(markdown, frontmatter, "")
      _ -> markdown
    end
  end

  defp parser_diagnostics(messages, entry) do
    Enum.map(messages, fn
      {severity, line, message} ->
        constructor = if severity == :error, do: &Diagnostic.error/3, else: &Diagnostic.warning/3

        constructor.(
          "markdown_parser_message",
          to_string(message),
          file: entry.path,
          source_id: entry.external_ref,
          details: %{line: line}
        )

      message ->
        Diagnostic.warning(
          "markdown_parser_message",
          to_string(message),
          file: entry.path,
          source_id: entry.external_ref
        )
    end)
  end

  defp convert_blocks(blocks, state) do
    Enum.reduce(blocks, {[], state}, fn block, {nodes, current_state} ->
      {converted, next_state} = convert_block(block, current_state)
      {nodes ++ converted, next_state}
    end)
  end

  defp convert_block({type, _attrs, children, _meta}, state) when type in @heading_types do
    {inline, state} = convert_inline(children, state)
    {[%{"type" => type, "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({"p", _attrs, children, _meta}, state) do
    {inline, state} = convert_inline(children, state)
    {[%{"type" => "p", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({"blockquote", _attrs, children, _meta}, state) do
    {inline, state} = block_children_to_inline(children, state)
    {[%{"type" => "blockquote", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({type, _attrs, items, _meta}, state) when type in ["ul", "ol"] do
    style = if type == "ol", do: "decimal", else: "disc"

    Enum.reduce(items, {[], state, 1}, fn item, {nodes, current_state, index} ->
      {node, next_state} = convert_list_item(item, style, index, current_state)
      {nodes ++ [node], next_state, index + 1}
    end)
    |> then(fn {nodes, next_state, _index} -> {nodes, next_state} end)
  end

  defp convert_block({"pre", _attrs, children, _meta}, state) do
    text = plain_ast(children)
    node = %{"type" => "p", "children" => [%{"text" => text, "code" => true}]}
    {[node], state}
  end

  defp convert_block({"hr", _attrs, _children, _meta}, state) do
    {[%{"type" => "hr", "children" => [%{"text" => ""}]}], state}
  end

  defp convert_block({"table", _attrs, children, _meta}, state) do
    state =
      add_diagnostic(
        state,
        Diagnostic.warning(
          "unsupported_markdown_table",
          "Markdown tables are preserved as plain text because the current editor has no table block",
          file: state.entry.path,
          source_id: state.entry.external_ref
        )
      )

    node = %{"type" => "p", "children" => [%{"text" => plain_ast(children)}]}
    {[node], state}
  end

  defp convert_block({"Callout", _attrs, children, _meta}, state) do
    {inline, state} = block_children_to_inline(children, state)
    {[%{"type" => "callout", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({"details", _attrs, children, _meta}, state) do
    {inline, state} = block_children_to_inline(children, state)
    {[%{"type" => "toggle", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({component, _attrs, children, %{verbatim: true}}, state) do
    state =
      add_diagnostic(
        state,
        Diagnostic.warning(
          "unsupported_mdx_component",
          "MDX/HTML component #{component} is not supported and was flattened to text",
          file: state.entry.path,
          source_id: state.entry.external_ref,
          details: %{component: component}
        )
      )

    {inline, state} = block_children_to_inline(children, state)
    {[%{"type" => "p", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block({_type, _attrs, children, _meta}, state) do
    {inline, state} = block_children_to_inline(children, state)
    {[%{"type" => "p", "children" => nonempty_inline(inline)}], state}
  end

  defp convert_block(text, state) when is_binary(text) do
    {[%{"type" => "p", "children" => [%{"text" => text}]}], state}
  end

  defp convert_list_item({"li", _attrs, children, _meta}, style, index, state) do
    {inline, state} = block_children_to_inline(children, state)
    {todo, inline} = todo_item(inline)

    node = %{
      "type" => "p",
      "indent" => 1,
      "listStyleType" => if(todo, do: "todo", else: style),
      "children" => nonempty_inline(inline)
    }

    node =
      cond do
        todo -> Map.put(node, "checked", todo == :checked)
        style == "decimal" -> Map.put(node, "listStart", index)
        true -> node
      end

    {node, state}
  end

  defp convert_list_item(item, style, index, state) do
    convert_list_item({"li", [], [plain_ast(item)], %{}}, style, index, state)
  end

  defp todo_item([%{"text" => text} = first | rest]) do
    cond do
      Regex.match?(~r/^\[[xX]\]\s+/, text) ->
        {:checked, [%{first | "text" => Regex.replace(~r/^\[[xX]\]\s+/, text, "")} | rest]}

      Regex.match?(~r/^\[ \]\s+/, text) ->
        {:unchecked, [%{first | "text" => Regex.replace(~r/^\[ \]\s+/, text, "")} | rest]}

      true ->
        {false, [first | rest]}
    end
  end

  defp todo_item(inline), do: {false, inline}

  defp block_children_to_inline(children, state) do
    Enum.reduce(children, {[], state}, fn
      {type, _attrs, nested, _meta}, {inline, current_state}
      when type in ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"] ->
        {converted, next_state} = convert_inline(nested, current_state)
        {inline ++ converted, next_state}

      child, {inline, current_state} ->
        {converted, next_state} = convert_inline([child], current_state)
        {inline ++ converted, next_state}
    end)
  end

  defp convert_inline(children, state) do
    Enum.reduce(children, {[], state}, fn child, {nodes, current_state} ->
      {converted, next_state} = convert_inline_node(child, current_state)
      {nodes ++ converted, next_state}
    end)
  end

  defp convert_inline_node(text, state) when is_binary(text), do: {[%{"text" => text}], state}

  defp convert_inline_node({mark, _attrs, children, _meta}, state)
       when mark in ["strong", "em", "del", "code"] do
    {inline, state} = convert_inline(children, state)

    key =
      case mark do
        "strong" -> "bold"
        "em" -> "italic"
        "del" -> "strikethrough"
        "code" -> "code"
      end

    {Enum.map(inline, &mark_leaf(&1, key)), state}
  end

  defp convert_inline_node({"a", attrs, children, _meta}, state) do
    href = attr(attrs, "href") || ""
    {href, state} = resolve_link(href, state)
    {inline, state} = convert_inline(children, state)
    {[%{"type" => "a", "url" => href, "children" => nonempty_inline(inline)}], state}
  end

  defp convert_inline_node({"img", attrs, _children, _meta}, state) do
    src = attr(attrs, "src") || ""
    alt = attr(attrs, "alt") || src
    {url, asset_key, state} = asset_url(src, state)

    node = %{"type" => "a", "url" => url, "children" => [%{"text" => alt}]}
    node = if asset_key, do: Map.put(node, "assetKey", asset_key), else: node
    {[node], state}
  end

  defp convert_inline_node({_type, _attrs, children, _meta}, state),
    do: convert_inline(children, state)

  defp convert_inline_node(value, state), do: {[%{"text" => plain_ast(value)}], state}

  defp resolve_link(href, %{link_resolver: nil} = state), do: {href, state}

  defp resolve_link(href, %{link_resolver: resolver} = state) when is_function(resolver, 2) do
    case resolver.(href, state.entry) do
      {:ok, resolved} when is_binary(resolved) ->
        {resolved, state}

      :keep ->
        {href, state}

      other ->
        diagnostic =
          Diagnostic.warning(
            "invalid_markdown_link_resolver_result",
            "Markdown link resolver returned an invalid result; the source URL was preserved",
            file: state.entry.path,
            source_id: state.entry.external_ref,
            details: %{url: href, result: inspect(other)}
          )

        {href, add_diagnostic(state, diagnostic)}
    end
  end

  defp mark_leaf(%{"text" => _text} = leaf, key), do: Map.put(leaf, key, true)

  defp mark_leaf(%{"children" => children} = node, key),
    do: %{node | "children" => Enum.map(children, &mark_leaf(&1, key))}

  defp mark_leaf(node, _key), do: node

  defp asset_url("", state), do: {"", nil, state}

  defp asset_url(src, state) do
    cond do
      String.starts_with?(src, "//") ->
        register_asset({:remote_url, "https:" <> src}, nil, src, state)

      remote_url?(src) ->
        register_asset({:remote_url, src}, nil, src, state)

      String.starts_with?(src, ["data:", "#"]) ->
        {src, nil, state}

      URI.parse(src).scheme != nil ->
        state =
          add_diagnostic(
            state,
            Diagnostic.warning(
              "unsupported_markdown_asset_scheme",
              "asset URL uses an unsupported scheme and was left unchanged",
              file: state.entry.path,
              source_id: state.entry.external_ref,
              details: %{url: src}
            )
          )

        {src, nil, state}

      true ->
        local_asset_url(src, state)
    end
  end

  defp local_asset_url(src, state) do
    raw_path = src |> String.split(["?", "#"], parts: 2) |> hd() |> URI.decode()

    base =
      if String.starts_with?(raw_path, "/"), do: "", else: Path.dirname(state.entry.path || "")

    case safe_relative_path(Path.join(base, String.trim_leading(raw_path, "/"))) do
      {:ok, external_ref} ->
        case Map.fetch(state.entries_by_ref, external_ref) do
          {:ok, %Entry{} = asset_entry} ->
            register_asset({:entry, external_ref}, external_ref, src, state, asset_entry)

          :error ->
            state =
              add_diagnostic(
                state,
                Diagnostic.warning(
                  "markdown_asset_entry_missing",
                  "relative asset does not match an Entry in the Snapshot",
                  file: state.entry.path,
                  source_id: state.entry.external_ref,
                  details: %{asset_path: external_ref, source_url: src}
                )
              )

            {src, nil, state}
        end

      :error ->
        state =
          add_diagnostic(
            state,
            Diagnostic.warning(
              "markdown_asset_path_traversal",
              "relative asset path escapes the source root and was rejected",
              file: state.entry.path,
              source_id: state.entry.external_ref,
              details: %{source_url: src}
            )
          )

        {src, nil, state}
    end
  end

  defp register_asset(source, source_path, original_url, state, entry \\ nil) do
    asset_key = asset_key(source)

    reference = %{
      "externalRef" => state.entry.external_ref,
      "sourcePath" => state.entry.path,
      "sourceUrl" => original_url
    }

    asset =
      case Map.get(state.assets, asset_key) do
        nil ->
          Asset.new!(%{
            asset_key: asset_key,
            source: source,
            source_path: source_path,
            mime_type: entry_mime_type(entry) || mime_type(original_url),
            references: [reference],
            status: :pending
          })

        %Asset{} = existing ->
          %{existing | references: Enum.uniq(existing.references ++ [reference])}
      end

    asset_keys =
      if asset_key in state.asset_keys, do: state.asset_keys, else: [asset_key | state.asset_keys]

    state = %{state | assets: Map.put(state.assets, asset_key, asset), asset_keys: asset_keys}
    {@placeholder_prefix <> asset_key, asset_key, state}
  end

  defp asset_key({:entry, external_ref}), do: hashed_asset_key("entry:" <> external_ref)
  defp asset_key({:remote_url, url}), do: hashed_asset_key("remote_url:" <> url)

  defp hashed_asset_key(value) do
    hash = Canonical.sha256(%{asset_source: value})
    "asset_" <> String.slice(hash, 0, 32)
  end

  defp safe_relative_path(path) do
    path
    |> String.replace("\\", "/")
    |> String.split("/", trim: true)
    |> Enum.reduce_while([], fn
      ".", acc -> {:cont, acc}
      "..", [] -> {:halt, :error}
      "..", [_parent | rest] -> {:cont, rest}
      segment, acc -> {:cont, [segment | acc]}
    end)
    |> case do
      :error -> :error
      segments -> {:ok, segments |> Enum.reverse() |> Enum.join("/")}
    end
  end

  defp remote_url?(url), do: URI.parse(url).scheme in ["http", "https"]

  defp entry_mime_type(%Entry{metadata: metadata}) do
    Map.get(metadata, :mime_type) || Map.get(metadata, "mime_type")
  end

  defp entry_mime_type(_entry), do: nil

  defp mime_type(path) do
    case path
         |> URI.parse()
         |> Map.get(:path)
         |> to_string()
         |> Path.extname()
         |> String.downcase() do
      ".png" -> "image/png"
      extension when extension in [".jpg", ".jpeg"] -> "image/jpeg"
      ".gif" -> "image/gif"
      ".webp" -> "image/webp"
      ".avif" -> "image/avif"
      ".svg" -> "image/svg+xml"
      _ -> nil
    end
  end

  defp attr(attrs, key), do: Enum.find_value(attrs, fn {name, value} -> name == key && value end)

  defp nonempty_inline([]), do: [%{"text" => ""}]
  defp nonempty_inline(inline), do: inline

  defp plain_ast(value) when is_binary(value), do: value
  defp plain_ast(values) when is_list(values), do: Enum.map_join(values, "", &plain_ast/1)
  defp plain_ast({_type, _attrs, children, _meta}), do: plain_ast(children)
  defp plain_ast(value), do: to_string(value)

  defp add_diagnostic(state, diagnostic),
    do: %{state | diagnostics: [diagnostic | state.diagnostics]}
end
