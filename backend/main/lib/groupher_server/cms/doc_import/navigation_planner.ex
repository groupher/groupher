defmodule GroupherServer.CMS.DocImport.NavigationPlanner do
  @moduledoc """
  Projects a provider-neutral `SourceTree` into Groupher's fixed docs shape.

      SourceTree                         Planned Groupher tree
      ----------                         ---------------------
      scope                              tab
        +-- page      -----+               +-- Overview group
        +-- link           |               |    +-- page/link
        +-- section   -----+------------>  +-- section group
             +-- page                      |    +-- page/link
             +-- section                   +-- nested section group
                  +-- page                      +-- page

  Policy in schema version 1:

  * every top-level source scope becomes one candidate tab;
  * pages/links directly inside a scope go into a generated `Overview` group;
  * every nested source section becomes a group;
  * deeper sections are flattened into sibling groups while retaining their
    source path in `sourceId`;
  * slugs are target candidates derived here, not source adapter data.

  This module plans navigation only. `ImportPlan` later adds the Preview Branch
  target and stable Article identities.
  """

  alias GroupherServer.CMS.DocImport.SourceTree

  @schema_version 1

  @doc "Projects source navigation into candidate Groupher tabs and groups."
  def plan(%{"source" => source, "navigation" => navigation}) do
    scopes = ensure_scopes(navigation)

    %{
      "schemaVersion" => @schema_version,
      "source" => source,
      "tabs" => Enum.map(scopes, &plan_scope/1)
    }
  end

  defp ensure_scopes(navigation) do
    if Enum.all?(navigation, &(&1["kind"] == "scope")) do
      navigation
    else
      [SourceTree.scope("inferred:default", "Docs", "/", navigation)]
    end
  end

  defp plan_scope(scope) do
    direct_children = Enum.filter(scope["children"], &(&1["kind"] in ["page", "link"]))
    sections = Enum.filter(scope["children"], &(&1["kind"] == "section"))

    groups =
      maybe_overview_group(scope, direct_children) ++
        Enum.flat_map(sections, &plan_section/1)

    %{
      "sourceId" => scope["sourceId"],
      "title" => scope["title"],
      "slug" => SourceTree.slug(scope["title"]),
      "groups" => groups,
      "pins" => []
    }
  end

  defp maybe_overview_group(_scope, []), do: []

  defp maybe_overview_group(scope, children) do
    [
      group(
        "planned:#{scope["sourceId"]}:overview",
        "Overview",
        Enum.map(children, &plan_leaf/1)
      )
    ]
  end

  defp plan_section(section) do
    leaves = Enum.filter(section["children"], &(&1["kind"] in ["page", "link"]))
    nested = Enum.filter(section["children"], &(&1["kind"] == "section"))
    title = section["title"]

    current =
      if leaves == [] do
        []
      else
        [group(section["sourceId"], title, Enum.map(leaves, &plan_leaf/1))]
      end

    current ++ Enum.flat_map(nested, &plan_section/1)
  end

  defp group(source_id, title, children) do
    %{
      "sourceId" => source_id,
      "title" => title,
      "slug" => SourceTree.slug(title),
      "children" => children
    }
  end

  defp plan_leaf(%{"kind" => "page"} = node) do
    %{
      "type" => "page",
      "sourceId" => node["sourceId"],
      "sourcePath" => node["sourcePath"],
      "title" => node["title"],
      "slug" => route_slug(node["route"]),
      "route" => node["route"]
    }
  end

  defp plan_leaf(%{"kind" => "link"} = node) do
    %{
      "type" => "link",
      "sourceId" => node["sourceId"],
      "title" => node["title"],
      "slug" => SourceTree.slug(node["title"]),
      "href" => node["href"]
    }
  end

  defp route_slug(route) do
    route
    |> String.split(["#", "?"], parts: 2)
    |> hd()
    |> String.trim("/")
    |> String.split("/")
    |> List.last()
    |> case do
      nil -> "index"
      "" -> "index"
      value -> SourceTree.slug(value)
    end
  end
end
