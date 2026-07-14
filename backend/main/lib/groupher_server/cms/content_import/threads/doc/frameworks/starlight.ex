defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Starlight do
  @moduledoc """
  Reads Astro Starlight sidebar configuration into a source tree.

      astro.config.mjs                    src/content/docs/
      ----------------                    -----------------
      starlight({                         index.mdx
        sidebar: [                        guides/
          {label: "Guides",                start.md
           autogenerate: {                 advanced.md
             directory: "guides"
           }},
          {label: "API", items: [...]}
        ]
      })
                |
                v
      SourceTree scope/section/page/link

  Static `slug`, `link`, nested `items` and `autogenerate.directory` entries
  are supported. The Astro configuration is inspected but never executed.
  """

  @behaviour GroupherServer.CMS.ContentImport.Threads.Doc.Framework

  alias GroupherServer.CMS.ContentImport.Diagnostic
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{DocumentFile, SourceTree, StaticConfig}

  @config_names ~w(astro.config.ts astro.config.js astro.config.mts astro.config.mjs)
  @content_roots ["src/content/docs", "src/content/docsCollection", "docs"]

  @impl true
  def parse(project_root) do
    with {:ok, config_path} <- find_config(project_root),
         {:ok, sidebar} <- StaticConfig.read_property(config_path, "sidebar") do
      site_root = Path.dirname(config_path)
      docs_root = find_content_root(site_root)
      relative_root = Path.relative_to(docs_root, project_root)
      {children, diagnostics} = nodes(sidebar, project_root, docs_root)

      {:ok,
       %{
         tree:
           SourceTree.new(
             :starlight,
             relative_root,
             [Path.relative_to(config_path, project_root)],
             [SourceTree.scope("sidebar:docs", "Docs", "/", children)]
           ),
         diagnostics: diagnostics
       }}
    else
      {:error, :config_not_found} ->
        Diagnostic.error_result("config_not_found", "Astro Starlight config was not found")

      {:error, :property_not_found} ->
        Diagnostic.error_result("sidebar_not_found", "static Starlight sidebar was not found")

      {:error, _reason} ->
        Diagnostic.error_result(
          "dynamic_config",
          "Starlight sidebar is dynamic and cannot be parsed safely"
        )
    end
  end

  defp find_config(root) do
    [root | Path.wildcard(Path.join(root, "*"))]
    |> Enum.flat_map(fn site_root -> Enum.map(@config_names, &Path.join(site_root, &1)) end)
    |> Enum.find(fn path ->
      case File.read(path) do
        {:ok, source} -> String.contains?(source, "starlight")
        _ -> false
      end
    end)
    |> case do
      nil -> {:error, :config_not_found}
      path -> {:ok, path}
    end
  end

  defp find_content_root(site_root) do
    Enum.find_value(@content_roots, Path.join(site_root, hd(@content_roots)), fn relative ->
      path = Path.join(site_root, relative)
      if File.dir?(path), do: path
    end)
  end

  defp nodes(items, project_root, docs_root) do
    items
    |> List.wrap()
    |> Enum.reduce({[], []}, fn item, {nodes, diagnostics} ->
      {next_nodes, next_diagnostics} = node(item, project_root, docs_root)
      {Enum.reverse(next_nodes, nodes), Enum.reverse(next_diagnostics, diagnostics)}
    end)
    |> then(fn {nodes, diagnostics} -> {Enum.reverse(nodes), Enum.reverse(diagnostics)} end)
  end

  defp node(slug, project_root, docs_root) when is_binary(slug),
    do: page(slug, nil, project_root, docs_root)

  defp node(%{"label" => label, "items" => items}, project_root, docs_root) do
    {children, diagnostics} = nodes(items, project_root, docs_root)

    {[
       SourceTree.section(
         "sidebar:#{SourceTree.slug(label)}",
         label,
         children
       )
     ], diagnostics}
  end

  defp node(
         %{"label" => label, "autogenerate" => %{"directory" => directory}},
         project_root,
         docs_root
       ) do
    children = directory_nodes(Path.join(docs_root, directory), project_root, docs_root)
    {[SourceTree.section("directory:#{directory}", label, children)], []}
  end

  defp node(%{"autogenerate" => %{"directory" => directory}}, project_root, docs_root),
    do: {directory_nodes(Path.join(docs_root, directory), project_root, docs_root), []}

  defp node(%{"slug" => []} = item, project_root, docs_root),
    do: page("", Map.get(item, "label"), project_root, docs_root)

  defp node(%{"slug" => slug} = item, project_root, docs_root),
    do: page(slug, Map.get(item, "label"), project_root, docs_root)

  defp node(%{"link" => href} = item, _project_root, _docs_root),
    do: {[SourceTree.link("external:#{href}", Map.get(item, "label", href), href)], []}

  defp node(_, _project_root, _docs_root), do: {[], []}

  defp page(slug, label, project_root, docs_root) do
    case DocumentFile.resolve(docs_root, String.trim(slug, "/")) do
      nil ->
        diagnostic =
          Diagnostic.warning("page_not_found", "Starlight sidebar page was not found",
            source_id: slug,
            file: Path.relative_to(docs_root, project_root)
          )

        {[], [diagnostic]}

      path ->
        source_path = Path.relative_to(path, project_root)
        title = label || page_metadata(path, slug).title
        {[SourceTree.page(source_path, title, "/" <> String.trim(slug, "/"), source_path)], []}
    end
  end

  defp directory_nodes(directory, project_root, docs_root) do
    if File.dir?(directory) do
      directory
      |> DocumentFile.entries()
      |> Enum.map(&directory_entry(&1, project_root, docs_root))
      |> Enum.reject(&is_nil/1)
      |> Enum.sort_by(fn {order, title, _node} -> {order, title} end)
      |> Enum.map(&elem(&1, 2))
    else
      []
    end
  end

  defp directory_entry(%{kind: :directory, name: name, path: path}, project_root, docs_root) do
    title = DocumentFile.humanize(name)
    children = directory_nodes(path, project_root, docs_root)

    node = SourceTree.section("directory:#{Path.relative_to(path, docs_root)}", title, children)
    {999_999, title, node}
  end

  defp directory_entry(%{kind: :file, path: path}, project_root, docs_root) do
    slug = path |> Path.relative_to(docs_root) |> Path.rootname() |> normalize_index()
    metadata = page_metadata(path, slug)
    source_path = Path.relative_to(path, project_root)

    node =
      SourceTree.page(source_path, metadata.title, "/" <> String.trim(slug, "/"), source_path)

    {metadata.order, metadata.title, node}
  end

  defp page_metadata(path, fallback) do
    frontmatter = DocumentFile.frontmatter(path)

    %{
      title: DocumentFile.title(path, fallback),
      order: DocumentFile.integer(frontmatter, "sidebar.order")
    }
  end

  defp normalize_index("index"), do: ""
  defp normalize_index(path), do: String.trim_trailing(path, "/index")
end
