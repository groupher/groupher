defmodule GroupherServer.CMS.DocImport do
  @moduledoc """
  Detects a supported docs-as-code project and delegates source-navigation
  extraction to its adapter.

  The input is a local project directory. Repository download and ZIP
  extraction will be added as a separate loader so this boundary remains
  deterministic and easy to test.
  """

  alias GroupherServer.CMS.DocImport.Adapters.{
    Docusaurus,
    Fumadocs,
    Mkdocs,
    Nextra,
    Rspress,
    Starlight,
    Vitepress
  }

  @spec parse_tree(Path.t()) ::
          {:ok, GroupherServer.CMS.DocImport.Adapter.result()} | {:error, map()}
  def parse_tree(project_root) do
    case detect(project_root) do
      {:ok, adapter} -> adapter.parse(project_root)
      {:error, diagnostic} -> {:error, diagnostic}
    end
  end

  @spec detect(Path.t()) :: {:ok, module()} | {:error, map()}
  def detect(project_root) do
    cond do
      fumadocs_project?(project_root) ->
        {:ok, Fumadocs}

      starlight_project?(project_root) ->
        {:ok, Starlight}

      mkdocs_project?(project_root) ->
        {:ok, Mkdocs}

      docusaurus_project?(project_root) ->
        {:ok, Docusaurus}

      has_any?(project_root, [
        "docs/.vitepress/config.ts",
        "docs/.vitepress/config.js",
        ".vitepress/config.ts",
        ".vitepress/config.js"
      ]) ->
        {:ok, Vitepress}

      rspress_project?(project_root) ->
        {:ok, Rspress}

      nextra_project?(project_root) ->
        {:ok, Nextra}

      true ->
        {:error,
         %{
           code: "unsupported_framework",
           severity: "error",
           message:
             "could not detect Fumadocs, Starlight, MkDocs, Docusaurus, VitePress, Rspress, or Nextra"
         }}
    end
  end

  defp has_any?(root, paths), do: Enum.any?(paths, &File.regular?(Path.join(root, &1)))

  defp fumadocs_project?(root) do
    source_config? =
      has_any?(root, ["source.config.ts", "source.config.js", "source.config.mjs"]) or
        root
        |> Path.join("*/source.config.{ts,js,mjs}")
        |> Path.wildcard()
        |> Enum.any?()

    source_config? or package_dependency?(root, "fumadocs-core") or
      package_dependency?(root, "fumadocs-mdx")
  end

  defp starlight_project?(root) do
    config_paths =
      Enum.flat_map(
        ~w(astro.config.ts astro.config.js astro.config.mts astro.config.mjs),
        fn name ->
          [Path.join(root, name) | Path.wildcard(Path.join([root, "*", name]))]
        end
      )

    Enum.any?(config_paths, fn path ->
      case File.read(path) do
        {:ok, source} -> String.contains?(source, ["@astrojs/starlight", "starlight("])
        _ -> false
      end
    end)
  end

  defp mkdocs_project?(root) do
    has_any?(root, ["mkdocs.yml", "mkdocs.yaml"]) or
      root
      |> Path.join("*/mkdocs.{yml,yaml}")
      |> Path.wildcard()
      |> Enum.any?()
  end

  defp docusaurus_project?(root) do
    has_any?(root, [
      "docusaurus.config.ts",
      "docusaurus.config.js",
      "docusaurus.config.mts",
      "docusaurus.config.mjs"
    ]) or
      root
      |> Path.join("*/docusaurus.config.{ts,js,mts,mjs}")
      |> Path.wildcard()
      |> Enum.any?()
  end

  defp rspress_project?(root) do
    root_match? =
      has_any?(root, [
        "rspress.config.ts",
        "rspress.config.js",
        "rspress.config.mts",
        "rspress.config.mjs"
      ])

    nested_match? =
      root
      |> Path.join("*/rspress.config.{ts,js,mts,mjs}")
      |> Path.wildcard()
      |> Enum.any?()

    root_match? or nested_match?
  end

  defp nextra_project?(root) do
    content_meta? =
      has_any?(root, [
        "content/_meta.ts",
        "content/_meta.js",
        "content/_meta.mjs",
        "src/content/_meta.ts",
        "src/content/_meta.js",
        "src/content/_meta.mjs"
      ])

    app_meta? =
      ([Path.join(root, "app"), Path.join(root, "src/app")] ++
         Path.wildcard(Path.join(root, "*/app")) ++
         Path.wildcard(Path.join(root, "*/src/app")))
      |> Enum.flat_map(&Path.wildcard(Path.join(&1, "_meta{.global,}.{tsx,ts,jsx,js}")))
      |> Enum.any?()

    content_meta? or app_meta? or nextra_dependency?(root)
  end

  defp nextra_dependency?(root) do
    with {:ok, body} <- File.read(Path.join(root, "package.json")),
         {:ok, package} <- Jason.decode(body) do
      package
      |> Map.take(["dependencies", "devDependencies"])
      |> Map.values()
      |> Enum.any?(&(is_map(&1) and Map.has_key?(&1, "nextra")))
    else
      _ -> false
    end
  end

  defp package_dependency?(root, dependency) do
    ([Path.join(root, "package.json")] ++ Path.wildcard(Path.join(root, "*/package.json")))
    |> Enum.any?(fn path ->
      with {:ok, body} <- File.read(path),
           {:ok, package} <- Jason.decode(body) do
        package
        |> Map.take(["dependencies", "devDependencies"])
        |> Map.values()
        |> Enum.any?(&(is_map(&1) and Map.has_key?(&1, dependency)))
      else
        _ -> false
      end
    end)
  end
end
