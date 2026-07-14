defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.VitePress do
  @moduledoc """
  Reads VitePress sidebar configuration into a source navigation tree.

      Simple project                      Localized/official project
      --------------                      --------------------------
      docs/.vitepress/config.ts           docs/.vitepress/config.ts
        sidebar: {...}                      site + locales
                                           |
                                           +-- docs/config.ts
                                                 defineAdditionalConfig
                                                 sidebar:
                                                   "/guide/": {
                                                     base: "/guide/",
                                                     items: sidebarGuide()
                                                   }

      sidebarGuide()
        |
        | static local function with one return array
        v
      SourceTree scope/section/page/link

  Supported inputs:

  * static `themeConfig.sidebar` arrays and route-prefix maps;
  * `{base, items}` sidebar scopes and nested items;
  * same-file zero-argument functions that return a static array/object;
  * `defineConfig` and `defineAdditionalConfig` because extraction starts from
    the `sidebar` property rather than evaluating the wrapper.

  Imports, environment branches, arbitrary expressions and plugin-generated
  navigation remain dynamic and are never executed.
  """

  @behaviour GroupherServer.CMS.ContentImport.Threads.Doc.Framework

  alias GroupherServer.CMS.ContentImport.Diagnostic
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{SourceSidebar, SourceTree, StaticConfig}

  @config_candidates [
    {"docs/config.ts", "docs/en"},
    {"docs/config.js", "docs/en"},
    {"docs/.vitepress/config.ts", "docs"},
    {"docs/.vitepress/config.js", "docs"},
    {".vitepress/config.ts", "."},
    {".vitepress/config.js", "."}
  ]

  @impl true
  def parse(project_root) do
    project_root
    |> existing_configs()
    |> parse_configs(project_root, [])
  end

  defp existing_configs(project_root) do
    Enum.filter(@config_candidates, fn {relative, _root} ->
      File.regular?(Path.join(project_root, relative))
    end)
  end

  defp parse_configs([], _project_root, []),
    do: Diagnostic.error_result("config_not_found", "VitePress config was not found")

  defp parse_configs([], _project_root, errors) do
    if Enum.any?(errors, &(&1 != :property_not_found)) do
      Diagnostic.error_result(
        "dynamic_config",
        "sidebar configuration is dynamic and cannot be parsed safely"
      )
    else
      Diagnostic.error_result(
        "sidebar_not_found",
        "static VitePress sidebar configuration was not found"
      )
    end
  end

  defp parse_configs([{relative, docs_root} | rest], project_root, errors) do
    path = Path.join(project_root, relative)

    case StaticConfig.read_property(path, "sidebar") do
      {:ok, sidebar} ->
        navigation = SourceSidebar.navigation(sidebar, project_root, docs_root)

        {:ok,
         %{
           tree: SourceTree.new(:vitepress, docs_root, [relative], navigation),
           diagnostics: []
         }}

      {:error, reason} ->
        parse_configs(rest, project_root, [reason | errors])
    end
  end
end
