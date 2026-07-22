defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Validator do
  @moduledoc """
  Validates SourceTree and confirmed Docs target intent without parsing source files.

      SourceTree + sourceInfo
               |
               v
      validate source contract -> plan TargetTree -> capture targetRevision
                                                     |
                                               user confirms
                                                     |
                                                     v
                              validate TargetTree + revision only

  Source semantics stay recursive here; the v1 flat Tabs/Groups TargetTree is
  introduced only by target planning. Confirmed intent is revalidated, never
  silently replanned, before Job creation and again inside atomic apply.

  See `docs/bulk-import/content-import-architecture.md` and
  `docs/bulk-import/bulk-import.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Articles.Branch
  alias GroupherServer.CMS.ContentImport.Persistence.{Connection, ImportSourceMapping}
  alias GroupherServer.CMS.Model.{ArticleBranch, Community, DocsSiteState}

  @max_depth 32
  @max_nodes 6_000

  @doc "Validates SourceTree and returns a read-only TargetTree, counts, conflicts, and revision."
  @spec preview(Community.t(), map(), map()) :: {:ok, map()} | {:error, term()}
  def preview(%Community{} = community, source_info, source_tree) do
    with {:ok, info} <- normalize_source_info(source_info),
         :ok <- validate_source_tree(source_tree),
         :ok <- validate_source_match(info, source_tree) do
      branch_slug = branch_slug(info["repo"], info["branch"])
      mapping_refs = source_mapping_refs(community, info)
      target_tree = plan_target_tree(source_tree, branch_slug, mapping_refs)
      {target_revision, conflicts} = target_state(community)

      {:ok,
       %{
         conflicts: conflicts,
         counts: counts(target_tree),
         target_revision: target_revision,
         target_tree: target_tree
       }}
    end
  end

  @doc "Revalidates only the confirmed target intent and revision; it never replans SourceTree."
  @spec validate_intent(Community.t(), map(), map(), String.t()) :: :ok | {:error, term()}
  def validate_intent(%Community{} = community, source_info, target_tree, target_revision) do
    with {:ok, info} <- normalize_source_info(source_info),
         branch_slug <- branch_slug(info["repo"], info["branch"]),
         mapping_refs <- source_mapping_refs(community, info),
         :ok <- validate_target_tree(target_tree, branch_slug, mapping_refs),
         {current_revision, conflicts} <- target_state(community),
         true <- current_revision == target_revision,
         [] <- conflicts do
      :ok
    else
      false -> {:error, {:custom, "The Docs target changed after Review"}}
      [_ | _] -> {:error, {:custom, "The confirmed Docs target is no longer available"}}
      error -> error
    end
  end

  @doc "Builds a deterministic source branch slug without exposing repository text as an ID."
  @spec branch_slug(String.t(), String.t()) :: String.t()
  def branch_slug(repo, branch) when is_binary(repo) and is_binary(branch) do
    repo_slug = repo |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "-") |> trim_slug()

    branch_slug =
      branch |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "-") |> trim_slug()

    digest =
      :sha256
      |> :crypto.hash("#{repo}\0#{branch}")
      |> Base.encode16(case: :lower)
      |> String.slice(0, 8)

    "github-#{String.slice(repo_slug, 0, 48)}-#{String.slice(branch_slug, 0, 32)}-#{digest}"
  end

  @doc "Removes non-ready pages and empty ancestors while retaining links beside ready pages."
  @spec filter_target_tree(map(), MapSet.t(String.t())) :: map()
  def filter_target_tree(target_tree, ready_external_refs) do
    tabs =
      target_tree
      |> Map.get("tabs", [])
      |> Enum.flat_map(fn tab ->
        groups = Map.get(tab, "groups", [])

        ready_in_tab? =
          Enum.any?(groups, fn group ->
            Enum.any?(Map.get(group, "children", []), fn child ->
              child["type"] == "page" and MapSet.member?(ready_external_refs, child["sourceId"])
            end)
          end)

        if ready_in_tab? do
          groups =
            groups
            |> Enum.map(fn group ->
              children =
                Enum.filter(Map.get(group, "children", []), fn child ->
                  child["type"] == "link" or
                    (child["type"] == "page" and
                       MapSet.member?(ready_external_refs, child["sourceId"]))
                end)

              Map.put(group, "children", children)
            end)
            |> Enum.reject(&(Map.get(&1, "children", []) == []))

          if groups == [], do: [], else: [Map.put(tab, "groups", groups)]
        else
          []
        end
      end)

    Map.put(target_tree, "tabs", tabs)
  end

  @doc "Indexes confirmed page targets by sourceId for Job item creation."
  @spec page_targets(map()) :: map()
  def page_targets(target_tree) do
    for tab <- Map.get(target_tree, "tabs", []),
        group <- Map.get(tab, "groups", []),
        child <- Map.get(group, "children", []),
        child["type"] == "page",
        into: %{} do
      {child["sourceId"], child}
    end
  end

  defp normalize_source_info(source_info) when is_map(source_info) do
    with {:ok, repo} <- required_string(source_info, "repo"),
         {:ok, repo_url} <- required_string(source_info, "repo_url"),
         {:ok, branch} <- required_string(source_info, "branch"),
         {:ok, commit} <- required_string(source_info, "commit"),
         {:ok, framework} <- required_string(source_info, "framework"),
         {:ok, content_root} <- required_string(source_info, "content_root"),
         {:ok, config_paths} <- string_list(source_info, "config_paths") do
      {:ok,
       %{
         "repo" => repo,
         "repo_url" => repo_url,
         "branch" => branch,
         "commit" => commit,
         "framework" => framework,
         "content_root" => content_root,
         "config_paths" => config_paths
       }}
    end
  end

  defp normalize_source_info(_), do: {:error, {:custom, "invalid sourceInfo contract"}}

  defp validate_source_tree(%{
         "schemaVersion" => 1,
         "source" => source,
         "navigation" => navigation
       })
       when is_map(source) and is_list(navigation) do
    with {:ok, _framework} <- required_string(source, "framework"),
         {:ok, _root} <- required_string(source, "root"),
         {:ok, _paths} <- string_list(source, "configPaths"),
         {:ok, _state} <- validate_source_nodes(navigation, 1, %{count: 0, ids: MapSet.new()}) do
      :ok
    end
  end

  defp validate_source_tree(_), do: {:error, {:custom, "invalid SourceTree contract"}}

  defp validate_source_nodes(_nodes, depth, _state) when depth > @max_depth,
    do: {:error, {:custom, "SourceTree exceeds depth #{@max_depth}"}}

  defp validate_source_nodes(nodes, depth, state) when is_list(nodes) do
    Enum.reduce_while(nodes, {:ok, state}, fn node, {:ok, current} ->
      count = current.count + 1

      cond do
        count > @max_nodes ->
          {:halt, {:error, {:custom, "SourceTree exceeds #{@max_nodes} nodes"}}}

        not is_map(node) ->
          {:halt, {:error, {:custom, "SourceTree contains an invalid node"}}}

        not valid_text?(node["sourceId"]) or not valid_text?(node["title"]) ->
          {:halt, {:error, {:custom, "SourceTree node identity and title are required"}}}

        MapSet.member?(current.ids, node["sourceId"]) ->
          {:halt, {:error, {:custom, "SourceTree contains a duplicate sourceId"}}}

        true ->
          next = %{count: count, ids: MapSet.put(current.ids, node["sourceId"])}

          case node["kind"] do
            kind when kind in ["scope", "section"] ->
              case validate_source_nodes(node["children"], depth + 1, next) do
                {:ok, state} -> {:cont, {:ok, state}}
                error -> {:halt, error}
              end

            "page" ->
              if valid_text?(node["route"]) and valid_text?(node["sourcePath"]),
                do: {:cont, {:ok, next}},
                else: {:halt, {:error, {:custom, "SourceTree page is invalid"}}}

            "link" ->
              if valid_text?(node["href"]),
                do: {:cont, {:ok, next}},
                else: {:halt, {:error, {:custom, "SourceTree link is invalid"}}}

            _ ->
              {:halt, {:error, {:custom, "SourceTree node kind is invalid"}}}
          end
      end
    end)
  end

  defp validate_source_nodes(_nodes, _depth, _state),
    do: {:error, {:custom, "SourceTree children must be a list"}}

  defp validate_source_match(info, %{"source" => source}) do
    if info["framework"] == source["framework"] and
         info["content_root"] == source["root"] and
         info["config_paths"] == source["configPaths"] do
      :ok
    else
      {:error, {:custom, "sourceInfo does not match the SourceTree source contract"}}
    end
  end

  defp plan_target_tree(
         %{"source" => source, "navigation" => navigation},
         branch_slug,
         mapping_refs
       ) do
    scopes =
      if Enum.all?(navigation, &(&1["kind"] == "scope")) do
        navigation
      else
        [
          %{
            "kind" => "scope",
            "sourceId" => "inferred:default",
            "title" => "Introduction",
            "children" => navigation
          }
        ]
      end

    %{
      "branchSlug" => branch_slug,
      "schemaVersion" => 1,
      "source" => source,
      "tabs" => Enum.map(scopes, &plan_scope(&1, branch_slug, mapping_refs))
    }
  end

  defp plan_scope(scope, branch_slug, mapping_refs) do
    direct = Enum.filter(scope["children"], &(&1["kind"] in ["page", "link"]))
    sections = Enum.filter(scope["children"], &(&1["kind"] == "section"))

    %{
      "sourceId" => scope["sourceId"],
      "title" => scope["title"],
      "slug" => slug(scope["title"]),
      "groups" =>
        maybe_default_group(scope, direct, branch_slug, mapping_refs) ++
          plan_sections(sections, branch_slug, mapping_refs),
      "pins" => []
    }
  end

  defp maybe_default_group(_scope, [], _branch_slug, _mapping_refs), do: []

  defp maybe_default_group(scope, children, branch_slug, mapping_refs) do
    [
      %{
        "sourceId" => "planned:#{scope["sourceId"]}:overview",
        "title" => "Untitled",
        "slug" => "untitled",
        "children" => Enum.map(children, &plan_leaf(&1, branch_slug, mapping_refs))
      }
    ]
  end

  defp plan_sections(sections, branch_slug, mapping_refs) do
    Enum.flat_map(sections, fn section ->
      leaves = Enum.filter(section["children"], &(&1["kind"] in ["page", "link"]))
      nested = Enum.filter(section["children"], &(&1["kind"] == "section"))

      current =
        if leaves == [] do
          []
        else
          [
            %{
              "sourceId" => section["sourceId"],
              "title" => section["title"],
              "slug" => slug(section["title"]),
              "children" => Enum.map(leaves, &plan_leaf(&1, branch_slug, mapping_refs))
            }
          ]
        end

      current ++ plan_sections(nested, branch_slug, mapping_refs)
    end)
  end

  defp plan_leaf(%{"kind" => "page"} = node, branch_slug, mapping_refs) do
    %{
      "type" => "page",
      "sourceId" => node["sourceId"],
      "sourcePath" => node["sourcePath"],
      "title" => node["title"],
      "slug" => route_slug(node["route"]),
      "route" => node["route"],
      "docId" =>
        Map.get(mapping_refs, node["sourceId"], target_ref(branch_slug, node["sourceId"]))
    }
  end

  defp plan_leaf(%{"kind" => "link"} = node, _branch_slug, _mapping_refs) do
    %{
      "type" => "link",
      "sourceId" => node["sourceId"],
      "title" => node["title"],
      "slug" => slug(node["title"]),
      "href" => node["href"]
    }
  end

  defp validate_target_tree(
         %{"branchSlug" => branch_slug, "schemaVersion" => 1, "tabs" => tabs},
         branch_slug,
         mapping_refs
       )
       when is_list(tabs) do
    tabs
    |> Enum.reduce_while({:ok, MapSet.new()}, fn tab, {:ok, ids} ->
      if is_map(tab) and is_list(tab["groups"]) and valid_text?(tab["sourceId"]) do
        case validate_target_groups(tab["groups"], branch_slug, mapping_refs, ids) do
          {:ok, ids} -> {:cont, {:ok, ids}}
          error -> {:halt, error}
        end
      else
        {:halt, {:error, {:custom, "confirmed TargetTree contains an invalid tab"}}}
      end
    end)
    |> case do
      {:ok, _ids} -> :ok
      error -> error
    end
  end

  defp validate_target_tree(_, _, _),
    do: {:error, {:custom, "confirmed TargetTree does not match source intent"}}

  defp validate_target_groups(groups, branch_slug, mapping_refs, ids) do
    Enum.reduce_while(groups, {:ok, ids}, fn group, {:ok, current} ->
      if is_map(group) and is_list(group["children"]) and valid_text?(group["sourceId"]) do
        case validate_target_children(group["children"], branch_slug, mapping_refs, current) do
          {:ok, ids} -> {:cont, {:ok, ids}}
          error -> {:halt, error}
        end
      else
        {:halt, {:error, {:custom, "confirmed TargetTree contains an invalid group"}}}
      end
    end)
  end

  defp validate_target_children(children, branch_slug, mapping_refs, ids) do
    Enum.reduce_while(children, {:ok, ids}, fn child, {:ok, current} ->
      if not is_map(child) do
        {:halt, {:error, {:custom, "confirmed TargetTree contains an invalid child"}}}
      else
        source_id = child["sourceId"]

        cond do
          not valid_text?(source_id) ->
            {:halt, {:error, {:custom, "confirmed TargetTree contains an invalid child"}}}

          MapSet.member?(current, source_id) ->
            {:halt, {:error, {:custom, "confirmed TargetTree contains a duplicate sourceId"}}}

          child["type"] == "page" and
              child["docId"] ==
                Map.get(mapping_refs, source_id, target_ref(branch_slug, source_id)) ->
            {:cont, {:ok, MapSet.put(current, source_id)}}

          child["type"] == "link" and valid_text?(child["href"]) ->
            {:cont, {:ok, MapSet.put(current, source_id)}}

          true ->
            {:halt, {:error, {:custom, "confirmed TargetTree child intent is invalid"}}}
        end
      end
    end)
  end

  defp source_mapping_refs(community, info) do
    case Repo.get_by(Connection,
           community_id: community.id,
           platform: :github,
           source_ref: info["repo"],
           connection_key: info["branch"]
         ) do
      %Connection{id: connection_id} ->
        ImportSourceMapping
        |> where(
          [mapping],
          mapping.connection_id == ^connection_id and mapping.thread == :doc
        )
        |> select([mapping], {mapping.external_ref, mapping.thread_ref})
        |> Repo.all()
        |> Map.new()

      nil ->
        %{}
    end
  end

  defp target_state(community) do
    branch_slug = Branch.main_slug()

    branch =
      ArticleBranch
      |> where([branch], branch.community_id == ^community.id)
      |> where([branch], branch.thread == :doc and branch.slug == ^branch_slug)
      |> Repo.one()

    case branch do
      nil ->
        {"doc:#{branch_slug}:0", []}

      %ArticleBranch{} = branch ->
        revision =
          DocsSiteState
          |> where([state], state.community_id == ^community.id and state.branch_id == ^branch.id)
          |> select([state], state.tree_lock_version)
          |> Repo.one() || 0

        {"doc:#{branch.slug}:#{revision}", []}
    end
  end

  defp counts(target_tree) do
    tabs = target_tree["tabs"]
    groups = Enum.flat_map(tabs, & &1["groups"])
    children = Enum.flat_map(groups, & &1["children"])

    %{
      assets: 0,
      groups: length(groups),
      links: Enum.count(children, &(&1["type"] == "link")),
      pages: Enum.count(children, &(&1["type"] == "page")),
      tabs: length(tabs)
    }
  end

  defp target_ref(branch_slug, source_id) do
    hex = :crypto.hash(:sha256, "#{branch_slug}\0#{source_id}") |> Base.encode16(case: :lower)

    "#{String.slice(hex, 0, 8)}-#{String.slice(hex, 8, 4)}-5#{String.slice(hex, 13, 3)}-8#{String.slice(hex, 17, 3)}-#{String.slice(hex, 20, 12)}"
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
      value -> slug(value)
    end
  end

  defp slug(value), do: value |> to_string() |> String.trim() |> String.downcase() |> trim_slug()

  defp trim_slug(value) do
    value
    |> String.replace(~r/[^a-z0-9\p{L}]+/u, "-")
    |> String.trim("-")
    |> case do
      "" -> "untitled"
      slug -> slug
    end
  end

  defp required_string(map, key) do
    case Map.get(map, key, Map.get(map, String.to_atom(key))) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:custom, "#{key} is required"}}
    end
  end

  defp string_list(map, key) do
    case Map.get(map, key, Map.get(map, String.to_atom(key))) do
      values when is_list(values) ->
        if Enum.all?(values, &is_binary/1),
          do: {:ok, values},
          else: {:error, {:custom, "#{key} must contain strings"}}

      _ ->
        {:error, {:custom, "#{key} must be a list"}}
    end
  end

  defp valid_text?(value), do: is_binary(value) and value != ""
end
