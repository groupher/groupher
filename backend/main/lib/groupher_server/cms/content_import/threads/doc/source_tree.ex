defmodule GroupherServer.CMS.ContentImport.Threads.Doc.SourceTree do
  @moduledoc """
  Provider-neutral navigation tree emitted by docs source adapters.

  The tree preserves source semantics and arbitrary nesting. In particular,
  `scope` means a source navigation scope, not a Groupher tab, and `section`
  means a source grouping, not a Groupher group. `NavigationPlanner` owns that
  later projection.

      Source project
           |
           v
      SourceTree
      navigation[]
        +-- scope
        |    +-- section
        |    |    +-- page
        |    |    +-- link
        |    |    +-- section ...
        |    +-- page
        +-- section
        +-- page

  Source nodes contain no Groupher `node_id` or `doc_id`.
  """

  @schema_version 1

  def new(framework, root, config_paths, navigation) do
    %{
      "schemaVersion" => @schema_version,
      "source" => %{
        "framework" => to_string(framework),
        "root" => root,
        "configPaths" => config_paths
      },
      "navigation" => navigation
    }
  end

  def scope(source_id, title, route_prefix, children) do
    %{
      "kind" => "scope",
      "sourceId" => source_id,
      "title" => title,
      "routePrefix" => route_prefix,
      "children" => children
    }
  end

  def section(source_id, title, children) do
    %{
      "kind" => "section",
      "sourceId" => source_id,
      "title" => title,
      "children" => children
    }
  end

  def page(source_id, title, route, source_path) do
    %{
      "kind" => "page",
      "sourceId" => source_id,
      "title" => title,
      "route" => route,
      "sourcePath" => source_path
    }
  end

  def link(source_id, title, href) do
    %{
      "kind" => "link",
      "sourceId" => source_id,
      "title" => title,
      "href" => href
    }
  end

  def slug(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\p{L}]+/u, "-")
    |> String.trim("-")
    |> case do
      "" -> "untitled"
      slug -> slug
    end
  end
end
