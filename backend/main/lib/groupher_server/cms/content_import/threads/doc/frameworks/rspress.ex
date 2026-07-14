defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Frameworks.Rspress do
  @moduledoc """
  Reads explicit or convention-based Rspress navigation.

      Explicit config                       Auto navigation
      ---------------                       ---------------
      rspress.config.ts                     docs/en/_nav.json
      themeConfig.sidebar                     +-- Guide
        "/guide/"                             +-- API
          +-- groups                                  |
               |                                      v
               +--------------------------> docs/en/guide/_meta.json
                                                +-- section-header
                                                +-- dir-section-header
                                                +-- file / dir / link
                                                        |
                                                        v
                                              SourceTree navigation

  Auto navigation is preferred when `_nav.json` exists. Static explicit
  `themeConfig.sidebar` remains supported. The adapter searches both a project
  root and one-level monorepo packages such as `website/`.
  """

  @behaviour GroupherServer.CMS.ContentImport.Threads.Doc.Framework

  alias GroupherServer.CMS.ContentImport.Diagnostic

  alias GroupherServer.CMS.ContentImport.Threads.Doc.{
    RspressAutoNavigation,
    SourceSidebar,
    SourceTree,
    StaticConfig
  }

  @config_names ~w(rspress.config.ts rspress.config.js rspress.config.mts rspress.config.mjs)

  @impl true
  def parse(project_root) do
    project_root
    |> config_paths()
    |> parse_projects(project_root, [])
  end

  defp config_paths(project_root) do
    root_configs = Enum.map(@config_names, &Path.join(project_root, &1))

    nested_configs =
      Enum.flat_map(@config_names, fn name ->
        Path.wildcard(Path.join([project_root, "*", name]))
      end)

    (root_configs ++ nested_configs)
    |> Enum.filter(&File.regular?/1)
    |> Enum.uniq()
  end

  defp parse_projects([], _project_root, []),
    do: Diagnostic.error_result("config_not_found", "Rspress config was not found")

  defp parse_projects([], _project_root, errors) do
    if Enum.any?(errors, &(&1 != :property_not_found)) do
      Diagnostic.error_result(
        "dynamic_config",
        "Rspress navigation is dynamic and cannot be parsed safely"
      )
    else
      Diagnostic.error_result(
        "navigation_not_found",
        "Rspress sidebar or _nav.json was not found"
      )
    end
  end

  defp parse_projects([config_path | rest], project_root, errors) do
    project_dir = Path.dirname(config_path)

    case resolve_auto_root(project_dir) do
      {:ok, docs_root, locale} ->
        parse_auto(project_root, project_dir, config_path, docs_root, locale)

      :missing ->
        case parse_explicit(project_root, project_dir, config_path) do
          {:ok, _result} = result -> result
          {:error, reason} -> parse_projects(rest, project_root, [reason | errors])
        end
    end
  end

  defp parse_auto(project_root, project_dir, config_path, docs_root, locale) do
    with {:ok, navigation, nav_paths} <-
           RspressAutoNavigation.parse(project_root, project_dir, docs_root, locale) do
      config_paths = [Path.relative_to(config_path, project_root) | nav_paths]

      {:ok,
       %{
         tree:
           SourceTree.new(
             :rspress,
             Path.relative_to(docs_root, project_root),
             config_paths,
             navigation
           ),
         diagnostics: []
       }}
    end
  end

  defp parse_explicit(project_root, project_dir, config_path) do
    with {:ok, sidebar} <- StaticConfig.read_property(config_path, "sidebar") do
      docs_root = Path.join(project_dir, "docs")
      relative_root = Path.relative_to(docs_root, project_root)
      navigation = SourceSidebar.navigation(sidebar, project_root, relative_root)

      {:ok,
       %{
         tree:
           SourceTree.new(
             :rspress,
             relative_root,
             [Path.relative_to(config_path, project_root)],
             navigation
           ),
         diagnostics: []
       }}
    end
  end

  defp resolve_auto_root(project_dir) do
    docs_root = Path.join(project_dir, "docs")

    cond do
      File.regular?(Path.join(docs_root, "_nav.json")) ->
        {:ok, docs_root, "en"}

      File.regular?(Path.join([docs_root, "en", "_nav.json"])) ->
        {:ok, Path.join(docs_root, "en"), "en"}

      true ->
        docs_root
        |> Path.join("*/_nav.json")
        |> Path.wildcard()
        |> List.first()
        |> case do
          nil -> :missing
          nav_path -> {:ok, Path.dirname(nav_path), Path.basename(Path.dirname(nav_path))}
        end
    end
  end
end
