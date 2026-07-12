defmodule GroupherServer.CMS.DocImport.Adapters.Nextra do
  @moduledoc """
  Reads Nextra content and co-located `_meta` files into a source tree.

      Nextra repository
      content/
        +-- _meta.ts
        +-- guide/
        |    +-- _meta.ts
        |    +-- index.mdx
        |    +-- advanced/
        |         +-- performance.mdx
        +-- reference/
             +-- api.md

      root _meta
      guide: {type: "page"}
      reference: {type: "page"}

                   |
                   v

      SourceTree.navigation
      +-- scope("Guide")             # Nextra top-level page/navigation scope
      |    +-- page(index.mdx)        # no invented "Pages" group
      |    +-- section("Advanced")
      |         +-- page(performance.mdx)
      +-- scope("Reference")
           +-- page(api.md)

  `_meta` controls title and order when it is a static literal. Missing or
  dynamic metadata falls back to deterministic filesystem order and emits a
  warning. JavaScript, TypeScript and JSX are never evaluated.
  """

  @behaviour GroupherServer.CMS.DocImport.Adapter

  alias GroupherServer.CMS.DocImport.{DocumentFile, SourceTree, StaticConfig}

  @meta_names ~w(
    _meta.global.tsx _meta.global.ts _meta.global.jsx _meta.global.js
    _meta.tsx _meta.ts _meta.jsx _meta.js _meta.mjs
  )

  @impl true
  def parse(project_root) do
    case resolve_source_root(project_root) do
      {:content, content_root} -> parse_content(project_root, content_root)
      {:app, app_root} -> parse_app(project_root, app_root)
      :missing -> unsupported_source_error()
    end
  end

  defp parse_content(project_root, content_root) do
    {navigation, diagnostics, config_paths} = navigation(project_root, content_root)

    {:ok,
     %{
       tree:
         SourceTree.new(
           :nextra,
           Path.relative_to(content_root, project_root),
           config_paths,
           navigation
         ),
       diagnostics: diagnostics
     }}
  end

  defp parse_app(project_root, app_root) do
    case read_meta(app_root) do
      {:ok, meta, meta_path} ->
        build_app_result(meta, meta_path, app_root, project_root)

      {:error, _reason} ->
        {:error,
         %{
           code: "dynamic_meta",
           severity: "error",
           message: "Nextra App Router metadata cannot be parsed safely"
         }}
    end
  end

  defp build_app_result(meta, meta_path, app_root, project_root) do
    navigation = app_root_nodes(meta, app_root, project_root)

    {:ok,
     %{
       tree:
         SourceTree.new(
           :nextra,
           Path.relative_to(app_root, project_root),
           [Path.relative_to(meta_path, project_root)],
           navigation
         ),
       diagnostics: []
     }}
  end

  defp resolve_source_root(project_root) do
    candidates = [
      {:content, Path.join(project_root, "content")},
      {:content, Path.join(project_root, "src/content")},
      {:app, Path.join(project_root, "app")},
      {:app, Path.join(project_root, "src/app")}
    ]

    case Enum.find(candidates, fn {type, path} -> source_root?(type, path) end) do
      nil -> resolve_nested_app(project_root)
      result -> result
    end
  end

  defp resolve_nested_app(project_root) do
    project_root
    |> Path.join("*/app/_meta{.global,}.{tsx,ts,jsx,js}")
    |> Path.wildcard()
    |> List.first()
    |> case do
      nil -> :missing
      meta_path -> {:app, Path.dirname(meta_path)}
    end
  end

  defp source_root?(:content, path), do: File.dir?(path)
  defp source_root?(:app, path), do: File.dir?(path) and match?({:ok, _, _}, read_meta(path))

  defp unsupported_source_error do
    {:error,
     %{
       code: "source_root_not_found",
       severity: "error",
       message: "Nextra content or App Router metadata root was not found"
     }}
  end

  defp navigation(project_root, content_root) do
    case read_meta(content_root) do
      {:ok, meta, meta_path} ->
        nodes =
          build_entries(project_root, content_root, content_root, ordered_entries(meta), :root)

        {nodes, [], [Path.relative_to(meta_path, project_root)]}

      {:error, reason} ->
        nodes =
          build_entries(
            project_root,
            content_root,
            content_root,
            inferred_entries(content_root),
            :root
          )

        {nodes, [meta_warning(reason, content_root, project_root)], []}
    end
  end

  defp build_entries(project_root, content_root, directory, entries, level) do
    Enum.flat_map(entries, fn {name, config} ->
      path = Path.join(directory, name)

      cond do
        File.dir?(path) ->
          [directory_node(project_root, content_root, path, name, config, level)]

        markdown_path = DocumentFile.resolve(directory, name) ->
          [page(project_root, content_root, markdown_path, title(config, name))]

        true ->
          []
      end
    end)
  end

  defp directory_node(project_root, content_root, path, name, config, level) do
    entries =
      case read_meta(path) do
        {:ok, meta, _meta_path} -> ordered_entries(meta)
        {:error, _reason} -> inferred_entries(path)
      end

    children = build_entries(project_root, content_root, path, entries, :nested)
    source_id = "directory:#{Path.relative_to(path, project_root)}"
    title = title(config, name)

    if level == :root and top_level_scope?(config) do
      route_prefix = "/" <> String.trim(Path.relative_to(path, content_root), "/") <> "/"
      SourceTree.scope(source_id, title, route_prefix, children)
    else
      SourceTree.section(source_id, title, children)
    end
  end

  defp page(project_root, content_root, path, configured_title) do
    relative_content = Path.relative_to(path, content_root)
    relative_project = Path.relative_to(path, project_root)
    name = path |> Path.basename() |> Path.rootname()
    title = configured_title || DocumentFile.declared_title(path) || humanize(name)

    SourceTree.page(relative_project, title, route(relative_content), relative_project)
  end

  defp app_root_nodes(meta, app_root, project_root) do
    meta
    |> ordered_entries()
    |> Enum.flat_map(fn {name, config} ->
      path = Path.join(app_root, name)

      cond do
        hidden?(config) ->
          []

        top_level_page?(config) and File.dir?(path) ->
          [app_scope(name, config, path, app_root, project_root)]

        true ->
          []
      end
    end)
  end

  defp app_scope(name, config, path, app_root, project_root) do
    title = explicit_title(config) || app_page_title(path) || humanize(name)

    children =
      case config do
        %{"items" => items} when is_map(items) ->
          app_meta_nodes(items, path, app_root, project_root)

        _ ->
          case app_page(path, title, app_root, project_root) do
            nil -> inferred_app_nodes(path, app_root, project_root)
            page -> [page]
          end
      end

    SourceTree.scope(
      "app:#{Path.relative_to(path, project_root)}",
      title,
      app_route_prefix(path, app_root),
      children
    )
  end

  defp app_meta_nodes(meta, directory, app_root, project_root) do
    meta
    |> ordered_entries()
    |> Enum.reduce({[], nil}, fn {name, config}, state ->
      reduce_app_meta(name, config, state, directory, app_root, project_root)
    end)
    |> flush_app_section()
    |> elem(0)
  end

  defp reduce_app_meta(
         _name,
         %{"type" => "separator"} = config,
         state,
         _directory,
         _app_root,
         _project_root
       ) do
    {nodes, _section} = flush_app_section(state)
    title = Map.get(config, "title", "Section")
    {nodes, SourceTree.section("separator:#{SourceTree.slug(title)}", title, [])}
  end

  defp reduce_app_meta(name, config, state, directory, app_root, project_root) do
    case app_meta_node(name, config, directory, app_root, project_root) do
      nil -> state
      node -> append_app_node(state, node)
    end
  end

  defp app_meta_node(name, %{"href" => href} = config, _directory, _app_root, _project_root) do
    SourceTree.link("meta-link:#{name}", title(config, name), href)
  end

  defp app_meta_node(name, %{"items" => items} = config, directory, app_root, project_root)
       when is_map(items) do
    path = Path.join(directory, name)
    children = app_meta_nodes(items, path, app_root, project_root)

    SourceTree.section(
      "app:#{Path.relative_to(path, project_root)}",
      title(config, name),
      children
    )
  end

  defp app_meta_node(name, config, directory, app_root, project_root) do
    path = if name == "index", do: directory, else: Path.join(directory, name)

    cond do
      page = app_page(path, meta_title(config), app_root, project_root) -> page
      File.dir?(path) -> app_directory_section(path, title(config, name), app_root, project_root)
      true -> nil
    end
  end

  defp app_directory_section(path, title, app_root, project_root) do
    children =
      case read_meta(path) do
        {:ok, meta, _meta_path} -> app_meta_nodes(meta, path, app_root, project_root)
        {:error, _reason} -> inferred_app_nodes(path, app_root, project_root)
      end

    SourceTree.section("app:#{Path.relative_to(path, project_root)}", title, children)
  end

  defp inferred_app_nodes(directory, app_root, project_root) do
    if File.dir?(directory) do
      directory
      |> File.ls!()
      |> Enum.reject(&String.starts_with?(&1, ["_", "."]))
      |> Enum.filter(&File.dir?(Path.join(directory, &1)))
      |> Enum.sort()
      |> Enum.flat_map(&inferred_app_node(&1, directory, app_root, project_root))
    else
      []
    end
  end

  defp inferred_app_node(name, directory, app_root, project_root) do
    path = Path.join(directory, name)

    case app_page(path, humanize(name), app_root, project_root) do
      nil -> [app_directory_section(path, humanize(name), app_root, project_root)]
      page -> [page]
    end
  end

  defp app_page(directory, configured_title, app_root, project_root) do
    [Path.join(directory, "page.mdx"), Path.join(directory, "page.md")]
    |> Enum.find(&File.regular?/1)
    |> case do
      nil ->
        nil

      path ->
        source_path = Path.relative_to(path, project_root)

        page_title =
          configured_title || DocumentFile.declared_title(path) ||
            humanize(Path.basename(directory))

        SourceTree.page(source_path, page_title, app_route(directory, app_root), source_path)
    end
  end

  defp app_page_title(directory) do
    [Path.join(directory, "page.mdx"), Path.join(directory, "page.md")]
    |> Enum.find(&File.regular?/1)
    |> case do
      nil -> nil
      path -> DocumentFile.declared_title(path)
    end
  end

  defp append_app_node({nodes, nil}, node), do: {nodes ++ [node], nil}

  defp append_app_node({nodes, section}, node) do
    {nodes, Map.update!(section, "children", &(&1 ++ [node]))}
  end

  defp flush_app_section({nodes, nil}), do: {nodes, nil}
  defp flush_app_section({nodes, section}), do: {nodes ++ [section], nil}

  defp app_route(directory, app_root) do
    relative = directory |> Path.relative_to(app_root) |> String.replace("\\", "/")
    "/" <> String.trim(relative, "/")
  end

  defp app_route_prefix(path, app_root) do
    route = app_route(path, app_root)
    if String.ends_with?(route, "/"), do: route, else: route <> "/"
  end

  defp top_level_page?(%{"type" => "page"}), do: true
  defp top_level_page?(_config), do: false

  defp hidden?(%{"display" => "hidden"}), do: true
  defp hidden?(_config), do: false

  defp read_meta(directory) do
    @meta_names
    |> Enum.map(&Path.join(directory, &1))
    |> Enum.find(&File.regular?/1)
    |> case do
      nil ->
        {:error, :meta_not_found}

      path ->
        case StaticConfig.read_export(path) do
          {:ok, meta} -> {:ok, meta, path}
          {:error, _reason} -> {:error, :dynamic_config}
        end
    end
  end

  defp inferred_entries(directory) do
    directory
    |> File.ls!()
    |> Enum.reject(&String.starts_with?(&1, ["_", "."]))
    |> Enum.map(&Path.rootname/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(&{&1, %{}})
  end

  defp ordered_entries(%{"__order__" => order} = meta),
    do: Enum.map(order, fn key -> {key, Map.fetch!(meta, key)} end)

  defp ordered_entries(meta) when is_map(meta),
    do: meta |> Map.delete("__order__") |> Enum.sort_by(fn {key, _value} -> key end)

  defp route(relative_path) do
    path = relative_path |> Path.rootname() |> String.replace("\\", "/")

    path =
      if String.ends_with?(path, "/index"), do: String.trim_trailing(path, "index"), else: path

    "/" <> String.trim(path, "/")
  end

  defp top_level_scope?(%{"type" => "page"}), do: true
  defp top_level_scope?(_config), do: false

  defp title(%{"title" => value}, _fallback) when is_binary(value) and value != "", do: value
  defp title(value, _fallback) when is_binary(value) and value != "", do: value
  defp title(_, fallback), do: humanize(fallback)

  defp explicit_title(%{"title" => value}) when is_binary(value) and value != "", do: value
  defp explicit_title(_config), do: nil

  defp meta_title(%{"title" => value}) when is_binary(value) and value != "", do: value
  defp meta_title(value) when is_binary(value) and value != "", do: value
  defp meta_title(_config), do: nil

  defp humanize(value),
    do:
      value
      |> String.replace(["-", "_"], " ")
      |> String.split()
      |> Enum.map_join(" ", &String.capitalize/1)

  defp meta_warning(:dynamic_config, directory, project_root) do
    %{
      code: "dynamic_meta",
      severity: "warning",
      message: "Nextra _meta is dynamic; directory order was inferred",
      file: Path.relative_to(directory, project_root)
    }
  end

  defp meta_warning(:meta_not_found, directory, project_root) do
    %{
      code: "meta_not_found",
      severity: "warning",
      message: "Nextra root _meta file was not found; directory order was inferred",
      file: Path.relative_to(directory, project_root)
    }
  end
end
