defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Fumadocs do
  @moduledoc """
  Reads Fumadocs `meta.json` navigation into a source tree.

      content/docs/                     meta.json
      -------------                     ---------
      index.mdx                         {
      guide/                              "title": "Docs",
        meta.json                         "pages": [
        start.mdx                           "index",
        advanced.mdx                       "---Guide---",
                                           "guide",
                                           "[GitHub](https://...)"
                                         ]
                                       }
                |
                v
      SourceTree scope/section/page/link

  Page order, separator sections, nested folders, external links and wildcard
  entries are supported. Missing metadata falls back to deterministic file-tree
  discovery; application and MDX configuration code is never executed.
  """

  @behaviour GroupherServer.CMS.ContentImport.Threads.Doc.Framework

  alias GroupherServer.CMS.ContentImport.Diagnostic
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{DocumentFile, SourceTree}

  @content_roots ["content/docs", "src/content/docs", "docs"]
  @source_configs ~w(source.config.ts source.config.js source.config.mjs)

  @impl true
  def parse(project_root) do
    with {:ok, site_root, source_config} <- find_site(project_root),
         {:ok, docs_root} <- find_docs_root(site_root) do
      {children, _meta_paths} = directory_nodes(docs_root, project_root, docs_root)
      diagnostics = missing_diagnostics(docs_root, project_root, docs_root)
      root_meta = read_meta(Path.join(docs_root, "meta.json"))

      title =
        case root_meta do
          {:ok, meta} -> Map.get(meta, "title", "Docs")
          _ -> "Docs"
        end

      config_paths =
        [source_config | Path.wildcard(Path.join(docs_root, "**/meta.json"))]
        |> Enum.reject(&is_nil/1)
        |> Enum.map(&Path.relative_to(&1, project_root))
        |> Enum.uniq()

      {:ok,
       %{
         tree:
           SourceTree.new(
             :fumadocs,
             Path.relative_to(docs_root, project_root),
             config_paths,
             [SourceTree.scope("meta:docs", title, "/", children)]
           ),
         diagnostics: diagnostics
       }}
    else
      {:error, :config_not_found} ->
        Diagnostic.error_result("config_not_found", "Fumadocs project was not found")

      {:error, :content_not_found} ->
        Diagnostic.error_result("content_not_found", "Fumadocs content directory was not found")
    end
  end

  defp find_site(root) do
    roots = [root | Path.wildcard(Path.join(root, "*"))]

    Enum.find_value(roots, {:error, :config_not_found}, fn site_root ->
      config =
        Enum.find_value(@source_configs, fn name -> existing(Path.join(site_root, name)) end)

      package = Path.join(site_root, "package.json")

      if config || fumadocs_package?(package), do: {:ok, site_root, config}
    end)
  end

  defp fumadocs_package?(path) do
    with {:ok, body} <- File.read(path),
         {:ok, package} <- Jason.decode(body) do
      package
      |> Map.take(["dependencies", "devDependencies"])
      |> Map.values()
      |> Enum.any?(fn dependencies ->
        is_map(dependencies) and
          Enum.any?(Map.keys(dependencies), &String.starts_with?(&1, "fumadocs-"))
      end)
    else
      _ -> false
    end
  end

  defp find_docs_root(site_root) do
    Enum.find_value(@content_roots, {:error, :content_not_found}, fn relative ->
      path = Path.join(site_root, relative)
      if File.dir?(path), do: {:ok, path}
    end)
  end

  defp directory_nodes(directory, project_root, docs_root) do
    case read_meta(Path.join(directory, "meta.json")) do
      {:ok, %{"pages" => pages}} ->
        {meta_nodes(pages, directory, project_root, docs_root),
         [Path.join(directory, "meta.json")]}

      _ ->
        inferred_nodes(directory, project_root, docs_root)
    end
  end

  defp meta_nodes(pages, directory, project_root, docs_root) do
    pages
    |> expand_wildcards(directory)
    |> Enum.reduce({[], nil}, fn item, state ->
      reduce_meta_item(item, state, directory, project_root, docs_root)
    end)
    |> flush_section()
    |> elem(0)
  end

  defp reduce_meta_item(item, {_nodes, _section} = state, directory, project_root, docs_root)
       when is_binary(item) do
    case separator_title(item) do
      nil ->
        node = item_node(item, directory, project_root, docs_root)
        if node, do: append_node(state, node), else: state

      title ->
        {flushed, _section} = flush_section(state)
        {flushed, SourceTree.section("separator:#{SourceTree.slug(title)}", title, [])}
    end
  end

  defp reduce_meta_item(item, state, directory, project_root, docs_root) do
    node = item_node(item, directory, project_root, docs_root)
    if node, do: append_node(state, node), else: state
  end

  defp item_node(item, directory, project_root, docs_root) when is_binary(item) do
    cond do
      link = markdown_link(item) ->
        {title, href} = link
        SourceTree.link("external:#{href}", title, href)

      File.dir?(Path.join(directory, item)) ->
        folder_node(item, directory, project_root, docs_root)

      true ->
        page_node(item, nil, directory, project_root, docs_root)
    end
  end

  defp item_node(%{"type" => "page", "name" => name} = item, directory, project_root, docs_root),
    do: page_node(name, Map.get(item, "title"), directory, project_root, docs_root)

  defp item_node(%{"type" => "folder", "name" => name}, directory, project_root, docs_root),
    do: folder_node(name, directory, project_root, docs_root)

  defp item_node(_, _directory, _project_root, _docs_root), do: nil

  defp folder_node(name, directory, project_root, docs_root) do
    path = Path.join(directory, name)

    if File.dir?(path) do
      {children, _meta_paths} = directory_nodes(path, project_root, docs_root)

      title =
        case read_meta(Path.join(path, "meta.json")) do
          {:ok, meta} -> Map.get(meta, "title", DocumentFile.humanize(name))
          _ -> DocumentFile.humanize(name)
        end

      SourceTree.section("directory:#{Path.relative_to(path, docs_root)}", title, children)
    end
  end

  defp missing_diagnostics(directory, project_root, docs_root) do
    case read_meta(Path.join(directory, "meta.json")) do
      {:ok, %{"pages" => pages}} ->
        Enum.flat_map(pages, &missing_item(&1, directory, project_root, docs_root))

      _ ->
        []
    end
  end

  defp missing_item("...", _directory, _project_root, _docs_root), do: []

  defp missing_item(item, directory, project_root, docs_root) when is_binary(item) do
    cond do
      separator_title(item) ->
        []

      markdown_link(item) ->
        []

      File.dir?(Path.join(directory, item)) ->
        missing_diagnostics(Path.join(directory, item), project_root, docs_root)

      DocumentFile.resolve(directory, item) ->
        []

      true ->
        [missing_page_warning(item, directory, project_root)]
    end
  end

  defp missing_item(%{"type" => "page", "name" => name}, directory, project_root, _docs_root) do
    if DocumentFile.resolve(directory, name),
      do: [],
      else: [missing_page_warning(name, directory, project_root)]
  end

  defp missing_item(%{"type" => "folder", "name" => name}, directory, project_root, docs_root) do
    path = Path.join(directory, name)

    if File.dir?(path) do
      missing_diagnostics(path, project_root, docs_root)
    else
      [
        Diagnostic.warning("folder_not_found", "Fumadocs metadata folder was not found",
          source_id: name,
          file: Path.relative_to(Path.join(directory, "meta.json"), project_root)
        )
      ]
    end
  end

  defp missing_item(_item, _directory, _project_root, _docs_root), do: []

  defp missing_page_warning(name, directory, project_root) do
    Diagnostic.warning("page_not_found", "Fumadocs metadata page was not found",
      source_id: name,
      file: Path.relative_to(Path.join(directory, "meta.json"), project_root)
    )
  end

  defp page_node(name, label, directory, project_root, docs_root) do
    path = DocumentFile.resolve(directory, name)

    if path do
      source_path = Path.relative_to(path, project_root)
      title = label || DocumentFile.title(path, Path.basename(name))
      SourceTree.page(source_path, title, DocumentFile.route(path, docs_root), source_path)
    end
  end

  defp inferred_nodes(directory, project_root, docs_root) do
    if File.dir?(directory) do
      entries = DocumentFile.entries(directory, ["meta.json"])

      nodes =
        Enum.map(entries, &item_node(Path.rootname(&1.name), directory, project_root, docs_root))

      {Enum.reject(nodes, &is_nil/1), []}
    else
      {[], []}
    end
  end

  defp expand_wildcards(pages, directory) do
    available =
      directory
      |> DocumentFile.entries(["meta.json"])
      |> Enum.map(&Path.rootname(&1.name))
      |> Enum.uniq()

    explicit = Enum.filter(pages, &is_binary/1)

    Enum.flat_map(pages, fn
      "..." -> available -- explicit
      item -> [item]
    end)
  end

  defp separator_title(item) do
    case Regex.run(~r/^---(.+)---$/, item, capture: :all_but_first) do
      [title] -> String.trim(title)
      _ -> nil
    end
  end

  defp markdown_link(item) do
    case Regex.run(~r/^\[([^]]+)\]\(([^)]+)\)$/, item, capture: :all_but_first) do
      [title, href] -> {title, href}
      _ -> nil
    end
  end

  defp append_node({nodes, nil}, node), do: {nodes ++ [node], nil}

  defp append_node({nodes, section}, node),
    do: {nodes, Map.update!(section, "children", &(&1 ++ [node]))}

  defp flush_section({nodes, nil}), do: {nodes, nil}
  defp flush_section({nodes, section}), do: {nodes ++ [section], nil}
  defp read_meta(path), do: with({:ok, body} <- File.read(path), do: Jason.decode(body))
  defp existing(path), do: if(File.regular?(path), do: path)
end
