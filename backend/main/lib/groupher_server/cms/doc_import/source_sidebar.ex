defmodule GroupherServer.CMS.DocImport.SourceSidebar do
  @moduledoc """
  Converts VitePress/Rspress sidebar literals into source navigation nodes.

      sidebar object
      --------------
      "/guide/"                    scope(routePrefix=/guide/)
        +-- Getting Started          +-- section(Getting Started)
             +-- /guide/       -->       +-- page
             +-- nested items             +-- section ...
             +-- https://...               +-- link

  Nested sidebar groups stay nested. No Groupher tab/group decision happens
  here.
  """

  alias GroupherServer.CMS.DocImport.SourceTree

  def navigation(sidebar, project_root, docs_root) when is_list(sidebar) do
    [scope("/", sidebar, "/", project_root, docs_root)]
  end

  def navigation(sidebar, project_root, docs_root) when is_map(sidebar) do
    sidebar
    |> ordered_entries()
    |> Enum.map(fn {prefix, config} ->
      {base, items} = scope_config(prefix, config)
      scope(prefix, items, base, project_root, docs_root)
    end)
  end

  defp scope(prefix, items, base, project_root, docs_root) do
    title = scope_title(prefix)

    SourceTree.scope(
      "sidebar:#{prefix}",
      title,
      base,
      Enum.flat_map(items, &node(&1, prefix, base, project_root, docs_root))
    )
  end

  defp node(
         %{"text" => title, "items" => items} = item,
         prefix,
         inherited_base,
         project_root,
         docs_root
       ) do
    base = Map.get(item, "base", inherited_base)

    root =
      case Map.get(item, "link") do
        link when is_binary(link) -> [leaf(title, link, base, project_root, docs_root)]
        _ -> []
      end

    children = root ++ Enum.flat_map(items, &node(&1, prefix, base, project_root, docs_root))

    [SourceTree.section("sidebar:#{prefix}:#{SourceTree.slug(title)}", title, children)]
  end

  defp node(
         %{"text" => title, "link" => link} = item,
         _prefix,
         inherited_base,
         project_root,
         docs_root
       ) do
    [leaf(title, link, Map.get(item, "base", inherited_base), project_root, docs_root)]
  end

  defp node(_, _prefix, _base, _project_root, _docs_root), do: []

  defp leaf(title, link, base, project_root, docs_root) do
    if external?(link) do
      SourceTree.link("external:#{link}", title, link)
    else
      link = apply_base(base, link)
      source_path = resolve_source_path(project_root, docs_root, link)
      SourceTree.page(source_path, title, normalize_route(link), source_path)
    end
  end

  defp scope_config(prefix, %{"items" => items} = config),
    do: {Map.get(config, "base", prefix), items}

  defp scope_config(prefix, items) when is_list(items), do: {prefix, items}

  defp apply_base(base, link) do
    cond do
      String.starts_with?(link, "/") -> link
      not is_binary(base) or base == "" -> link
      true -> base <> link
    end
  end

  defp resolve_source_path(project_root, docs_root, route) do
    relative =
      route
      |> String.split(["#", "?"], parts: 2)
      |> hd()
      |> String.trim_leading("/")

    candidates = source_candidates(docs_root, relative)
    Enum.find(candidates, List.first(candidates), &File.regular?(Path.join(project_root, &1)))
  end

  defp source_candidates(docs_root, relative)
       when relative == "" or is_binary(relative) do
    if relative == "" or String.ends_with?(relative, "/") do
      [
        Path.join([docs_root, relative, "index.md"]),
        Path.join([docs_root, relative, "index.mdx"])
      ]
    else
      [
        Path.join(docs_root, relative <> ".md"),
        Path.join(docs_root, relative <> ".mdx"),
        Path.join([docs_root, relative, "index.md"]),
        Path.join([docs_root, relative, "index.mdx"])
      ]
    end
  end

  defp normalize_route(route) do
    route = route |> String.split(["#", "?"], parts: 2) |> hd()
    if String.starts_with?(route, "/"), do: route, else: "/" <> route
  end

  defp external?(link), do: String.starts_with?(link, ["http://", "https://", "mailto:"])

  defp ordered_entries(%{"__order__" => order} = map),
    do: Enum.map(order, fn key -> {key, Map.fetch!(map, key)} end)

  defp ordered_entries(map), do: Enum.sort_by(map, fn {key, _value} -> key end)

  defp scope_title(prefix) do
    prefix
    |> String.trim("/")
    |> String.split("/")
    |> List.last()
    |> case do
      nil -> "Docs"
      "" -> "Docs"
      value -> humanize(value)
    end
  end

  defp humanize(value),
    do:
      value
      |> String.replace(["-", "_"], " ")
      |> String.split()
      |> Enum.map_join(" ", &String.capitalize/1)
end
