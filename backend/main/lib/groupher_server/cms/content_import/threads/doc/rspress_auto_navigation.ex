defmodule GroupherServer.CMS.ContentImport.Threads.Doc.RspressAutoNavigation do
  @moduledoc """
  Reads Rspress `_nav.json` and co-located `_meta.json` files.

      docs/en/_nav.json
      +-- Guide -> /guide/          scope(Guide)
      +-- API   -> /api/      -->   scope(API)

      docs/en/guide/_meta.json
      +-- dir-section-header        section(label)
      |    name=start                 +-- pages from start/_meta.json
      +-- section-header            section(label)
      |    +-- following files        +-- following pages
      +-- file / dir / link         page / section / link

  Label values are resolved through the project `i18n.json` when possible.
  Missing metadata falls back to deterministic directory order.
  """

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{DocumentFile, SourceTree}

  @doc "Builds source navigation for one resolved Rspress locale directory."
  def parse(project_root, project_dir, docs_root, locale) do
    with {:ok, nav} <- read_json(Path.join(docs_root, "_nav.json")) do
      translations = read_translations(project_dir)

      navigation =
        nav
        |> Enum.flat_map(&nav_scope(&1, project_root, docs_root, locale, translations))

      {:ok, navigation, [Path.relative_to(Path.join(docs_root, "_nav.json"), project_root)]}
    end
  end

  defp nav_scope(
         %{"text" => title, "link" => link} = item,
         project_root,
         docs_root,
         locale,
         translations
       ) do
    if external?(link) do
      []
    else
      prefix = Map.get(item, "activeMatch") || route_prefix(link)
      directory = Path.join(docs_root, first_route_segment(prefix))
      children = directory_nodes(directory, project_root, docs_root, locale, translations)

      [
        SourceTree.scope(
          "nav:#{prefix}",
          resolve_label(title, locale, translations),
          prefix,
          children
        )
      ]
    end
  end

  defp nav_scope(_item, _project_root, _docs_root, _locale, _translations), do: []

  defp directory_nodes(directory, project_root, docs_root, locale, translations) do
    case read_json(Path.join(directory, "_meta.json")) do
      {:ok, entries} ->
        meta_nodes(entries, directory, project_root, docs_root, locale, translations)

      {:error, _reason} ->
        inferred_nodes(directory, project_root, docs_root, locale, translations)
    end
  end

  defp meta_nodes(entries, directory, project_root, docs_root, locale, translations) do
    entries
    |> Enum.reduce({[], nil}, fn entry, state ->
      reduce_meta_entry(entry, state, directory, project_root, docs_root, locale, translations)
    end)
    |> flush_section()
    |> elem(0)
  end

  defp reduce_meta_entry(
         %{"type" => "section-header", "label" => label},
         state,
         _directory,
         _project_root,
         _docs_root,
         locale,
         translations
       ) do
    {nodes, _current} = flush_section(state)
    title = resolve_label(label, locale, translations)
    {nodes, SourceTree.section("section:#{SourceTree.slug(title)}", title, [])}
  end

  defp reduce_meta_entry(
         %{"type" => "dir-section-header", "name" => name} = entry,
         state,
         directory,
         project_root,
         docs_root,
         locale,
         translations
       ) do
    path = Path.join(directory, name)
    title = resolve_label(Map.get(entry, "label", name), locale, translations)
    children = directory_nodes(path, project_root, docs_root, locale, translations)

    node =
      SourceTree.section("directory:#{Path.relative_to(path, project_root)}", title, children)

    append_node(state, node)
  end

  defp reduce_meta_entry(
         entry,
         state,
         directory,
         project_root,
         docs_root,
         locale,
         translations
       ) do
    case entry_node(entry, directory, project_root, docs_root, locale, translations) do
      nil -> state
      node -> append_node(state, node)
    end
  end

  defp entry_node(name, directory, project_root, docs_root, locale, translations)
       when is_binary(name) do
    path_node(name, nil, directory, project_root, docs_root, locale, translations)
  end

  defp entry_node(
         %{"type" => "file", "name" => name} = entry,
         directory,
         project_root,
         docs_root,
         locale,
         translations
       ) do
    path_node(
      name,
      Map.get(entry, "label"),
      directory,
      project_root,
      docs_root,
      locale,
      translations
    )
  end

  defp entry_node(
         %{"type" => "dir", "name" => name} = entry,
         directory,
         project_root,
         docs_root,
         locale,
         translations
       ) do
    path = Path.join(directory, name)
    title = resolve_label(Map.get(entry, "label", name), locale, translations)
    children = directory_nodes(path, project_root, docs_root, locale, translations)
    SourceTree.section("directory:#{Path.relative_to(path, project_root)}", title, children)
  end

  defp entry_node(
         %{"type" => "link", "link" => href} = entry,
         _directory,
         _project_root,
         _docs_root,
         locale,
         translations
       ) do
    title = resolve_label(Map.get(entry, "label", href), locale, translations)
    SourceTree.link("external:#{href}", title, href)
  end

  defp entry_node(_entry, _directory, _project_root, _docs_root, _locale, _translations), do: nil

  defp path_node(name, label, directory, project_root, docs_root, locale, translations) do
    case resolve_content_path(directory, name) do
      {:file, path} ->
        title =
          resolve_label(
            label || DocumentFile.title(path, Path.basename(name)),
            locale,
            translations
          )

        source_path = Path.relative_to(path, project_root)
        SourceTree.page(source_path, title, DocumentFile.route(path, docs_root), source_path)

      {:directory, path} ->
        title = resolve_label(label || DocumentFile.humanize(name), locale, translations)
        children = directory_nodes(path, project_root, docs_root, locale, translations)
        SourceTree.section("directory:#{Path.relative_to(path, project_root)}", title, children)

      :missing ->
        nil
    end
  end

  defp resolve_content_path(directory, name) do
    bare = Path.join(directory, name)

    case DocumentFile.resolve(directory, name) do
      nil -> if File.dir?(bare), do: {:directory, bare}, else: :missing
      path -> {:file, path}
    end
  end

  defp inferred_nodes(directory, project_root, docs_root, locale, translations) do
    if File.dir?(directory) do
      directory
      |> DocumentFile.entries()
      |> Enum.map(&Path.rootname(&1.name))
      |> Enum.uniq()
      |> Enum.map(&path_node(&1, nil, directory, project_root, docs_root, locale, translations))
      |> Enum.reject(&is_nil/1)
    else
      []
    end
  end

  defp append_node({nodes, nil}, node), do: {nodes ++ [node], nil}

  defp append_node({nodes, section}, node) do
    section = Map.update!(section, "children", &(&1 ++ [node]))
    {nodes, section}
  end

  defp flush_section({nodes, nil}), do: {nodes, nil}
  defp flush_section({nodes, section}), do: {nodes ++ [section], nil}

  defp read_translations(project_dir) do
    case read_json(Path.join(project_dir, "i18n.json")) do
      {:ok, translations} when is_map(translations) -> translations
      _ -> %{}
    end
  end

  defp resolve_label(nil, _locale, _translations), do: "Untitled"

  defp resolve_label(label, locale, translations) do
    case get_in(translations, [label, locale]) do
      translated when is_binary(translated) -> translated
      _ -> label
    end
  end

  defp read_json(path) do
    with {:ok, body} <- File.read(path), do: Jason.decode(body)
  end

  defp route_prefix(link) do
    case String.split(String.trim(link, "/"), "/") do
      [segment | _rest] -> "/#{segment}/"
      _ -> "/"
    end
  end

  defp first_route_segment(prefix) do
    prefix |> String.trim("/") |> String.split("/") |> List.first()
  end

  defp external?(link), do: String.starts_with?(link, ["http://", "https://", "mailto:"])
end
