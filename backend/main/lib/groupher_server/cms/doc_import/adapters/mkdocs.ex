defmodule GroupherServer.CMS.DocImport.Adapters.Mkdocs do
  @moduledoc """
  Reads MkDocs and Material for MkDocs navigation without loading Python code.

      mkdocs.yml                         docs/
      ----------                         -----
      docs_dir: docs                     index.md
      nav:                               guide/
        - Home: index.md          +        start.md
        - Guide:                         advanced.md
            - Start: guide/start.md
        - Project: https://...
                |
                v
      SourceTree scope/section/page/link

  When `nav` is absent, the adapter follows MkDocs' default and builds a tree
  from `docs_dir`. YAML extensions such as `!include` are reported as dynamic
  instead of being executed.
  """

  @behaviour GroupherServer.CMS.DocImport.Adapter

  alias GroupherServer.CMS.DocImport.{Diagnostic, DocumentFile, SourceTree}

  @config_names ~w(mkdocs.yml mkdocs.yaml)

  @impl true
  def parse(project_root) do
    with {:ok, config_path} <- find_config(project_root),
         {:ok, source} <- File.read(config_path),
         :ok <- reject_extensions(source) do
      site_root = Path.dirname(config_path)
      docs_dir = scalar_property(source, "docs_dir") || "docs"
      docs_root = Path.join(site_root, docs_dir)
      relative_root = Path.relative_to(docs_root, project_root)

      children =
        case nav_lines(source) do
          [] -> directory_nodes(docs_root, project_root, docs_root)
          lines -> lines |> parse_nav() |> nav_nodes(project_root, docs_root)
        end

      navigation = [SourceTree.scope("nav:docs", "Docs", "/", children)]

      {:ok,
       %{
         tree:
           SourceTree.new(
             :mkdocs,
             relative_root,
             [Path.relative_to(config_path, project_root)],
             navigation
           ),
         diagnostics: []
       }}
    else
      {:error, :config_not_found} ->
        Diagnostic.error_result("config_not_found", "MkDocs config was not found")

      {:error, :dynamic_config} ->
        Diagnostic.error_result(
          "dynamic_config",
          "MkDocs navigation uses an unsupported YAML extension"
        )

      {:error, _reason} ->
        Diagnostic.error_result("invalid_config", "MkDocs config could not be read")
    end
  end

  defp find_config(root) do
    [root | Path.wildcard(Path.join(root, "*"))]
    |> Enum.flat_map(fn site_root -> Enum.map(@config_names, &Path.join(site_root, &1)) end)
    |> Enum.find(&File.regular?/1)
    |> case do
      nil -> {:error, :config_not_found}
      path -> {:ok, path}
    end
  end

  defp reject_extensions(source) do
    if Regex.match?(~r/^\s*nav\s*:\s*![A-Za-z]/m, source),
      do: {:error, :dynamic_config},
      else: :ok
  end

  defp scalar_property(source, property) do
    pattern = ~r/^#{Regex.escape(property)}\s*:\s*([^#\n]+)$/m

    case Regex.run(pattern, source, capture: :all_but_first) do
      [value] -> clean_scalar(value)
      _ -> nil
    end
  end

  defp nav_lines(source) do
    lines = String.split(source, "\n")

    case Enum.find_index(lines, &Regex.match?(~r/^nav\s*:\s*(?:#.*)?$/, &1)) do
      nil -> []
      index -> take_indented(Enum.drop(lines, index + 1))
    end
  end

  defp take_indented(lines) do
    lines
    |> Enum.drop_while(&blank_or_comment?/1)
    |> Enum.take_while(fn line -> blank_or_comment?(line) or indentation(line) > 0 end)
    |> Enum.reject(&blank_or_comment?/1)
  end

  defp parse_nav(lines) do
    entries = Enum.map(lines, &{indentation(&1), String.trim(&1)})
    {nodes, _rest} = parse_level(entries, entries |> hd() |> elem(0))
    nodes
  end

  defp parse_level(entries, level), do: parse_level(entries, level, [])

  defp parse_level([], _level, acc), do: {Enum.reverse(acc), []}

  defp parse_level([{indent, _line} | _rest] = entries, level, acc) when indent < level,
    do: {Enum.reverse(acc), entries}

  defp parse_level([{indent, _line} | _rest] = entries, level, acc) when indent > level,
    do: {Enum.reverse(acc), entries}

  defp parse_level([{level, line} | rest], level, acc) do
    item = String.trim_leading(line, "-") |> String.trim()
    {label, value} = split_item(item)

    if value == nil do
      child_level = next_level(rest, level)
      {children, remaining} = parse_level(rest, child_level)
      parse_level(remaining, level, [{:section, label, children} | acc])
    else
      parse_level(rest, level, [{:leaf, label, value} | acc])
    end
  end

  defp next_level([{indent, _line} | _rest], level) when indent > level, do: indent
  defp next_level(_entries, level), do: level + 2

  defp split_item(item) do
    case Regex.run(~r/^((?:"[^"]*"|'[^']*'|[^:])+):(?:\s*(.*))?$/, item, capture: :all_but_first) do
      [label, ""] -> {clean_scalar(label), nil}
      [label, value] -> {clean_scalar(label), clean_scalar(value)}
      _ -> {nil, clean_scalar(item)}
    end
  end

  defp nav_nodes(entries, project_root, docs_root) do
    Enum.map(entries, fn
      {:section, title, children} ->
        SourceTree.section(
          "nav:#{SourceTree.slug(title)}",
          title,
          nav_nodes(children, project_root, docs_root)
        )

      {:leaf, label, target} ->
        leaf(label, target, project_root, docs_root)
    end)
  end

  defp leaf(label, target, project_root, docs_root) do
    path = Path.join(docs_root, target)

    cond do
      external?(target) ->
        SourceTree.link("external:#{target}", label || target, target)

      File.dir?(path) ->
        title = label || DocumentFile.humanize(Path.basename(target))

        SourceTree.section(
          "directory:#{Path.relative_to(path, project_root)}",
          title,
          directory_nodes(path, project_root, docs_root)
        )

      true ->
        source_path = Path.relative_to(path, project_root)
        title = label || DocumentFile.title(path, Path.rootname(Path.basename(target)))
        SourceTree.page(source_path, title, DocumentFile.route(path, docs_root), source_path)
    end
  end

  defp directory_nodes(directory, project_root, docs_root) do
    if File.dir?(directory) do
      directory
      |> DocumentFile.entries()
      |> Enum.map(&directory_entry(&1, project_root, docs_root))
      |> Enum.reject(&is_nil/1)
      |> Enum.sort_by(fn {rank, title, _node} -> {rank, title} end)
      |> Enum.map(&elem(&1, 2))
    else
      []
    end
  end

  defp directory_entry(%{kind: :directory, name: name, path: path}, project_root, docs_root) do
    title = DocumentFile.humanize(name)
    children = directory_nodes(path, project_root, docs_root)

    {1, title,
     SourceTree.section("directory:#{Path.relative_to(path, project_root)}", title, children)}
  end

  defp directory_entry(%{kind: :file, name: name, path: path}, project_root, docs_root) do
    source_path = Path.relative_to(path, project_root)
    title = DocumentFile.title(path, Path.rootname(name))
    rank = if Path.rootname(name) == "index", do: 0, else: 1

    {rank, title,
     SourceTree.page(source_path, title, DocumentFile.route(path, docs_root), source_path)}
  end

  defp clean_scalar(nil), do: nil
  defp clean_scalar(value), do: value |> String.trim() |> String.trim("\"'")

  defp blank_or_comment?(line),
    do: String.trim(line) == "" or String.starts_with?(String.trim(line), "#")

  defp indentation(line), do: byte_size(line) - byte_size(String.trim_leading(line))
  defp external?(target), do: String.starts_with?(target, ["http://", "https://", "mailto:"])
end
