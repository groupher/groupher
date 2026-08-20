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

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.ContentImport.Persistence.{Connection, ImportSourceMapping}
  alias GroupherServer.CMS.Docs.Branch
  alias GroupherServer.CMS.Model.{Community, DocBranch, DocsSiteState}

  @max_depth CMS.Const.doc_tree_max_depth()
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
      false ->
        {:error, GroupherServer.ErrorCat.custom("The Docs target changed after Review")}

      [_ | _] ->
        {:error,
         GroupherServer.ErrorCat.custom("The confirmed Docs target is no longer available")}

      error ->
        error
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
        {groups, ready?} =
          filter_target_children(Map.get(tab, "groups", []), ready_external_refs)

        if ready?, do: [Map.put(tab, "groups", groups)], else: []
      end)

    Map.put(target_tree, "tabs", tabs)
  end

  @doc "Indexes confirmed page targets by sourceId for Job item creation."
  @spec page_targets(map()) :: map()
  def page_targets(target_tree) do
    target_tree
    |> Map.get("tabs", [])
    |> Enum.flat_map(&collect_target_pages(Map.get(&1, "groups", [])))
    |> Map.new(&{&1["sourceId"], &1})
  end

  defp filter_target_children(pages, ready_external_refs) do
    pages
    |> Enum.reduce({[], false}, &filter_target_child(&1, &2, ready_external_refs))
    |> then(fn {pages, ready?} ->
      pages = Enum.reverse(pages)
      if ready?, do: {pages, true}, else: {[], false}
    end)
  end

  defp filter_target_child(%{"type" => "page"} = child, {kept, ready?}, ready_refs) do
    if MapSet.member?(ready_refs, child["sourceId"]),
      do: {[child | kept], true},
      else: {kept, ready?}
  end

  defp filter_target_child(%{"type" => "link"} = child, {kept, ready?}, _ready_refs),
    do: {[child | kept], ready?}

  defp filter_target_child(%{"type" => "group"} = child, {kept, ready?}, ready_refs) do
    {nested, nested_ready?} = filter_target_children(Map.get(child, "pages", []), ready_refs)

    if nested_ready?, do: {[Map.put(child, "pages", nested) | kept], true}, else: {kept, ready?}
  end

  defp filter_target_child(_child, accumulator, _ready_refs), do: accumulator

  defp collect_target_pages(pages) do
    Enum.flat_map(pages, fn
      %{"type" => "page"} = page -> [page]
      %{"type" => "group", "pages" => nested} -> collect_target_pages(nested)
      _ -> []
    end)
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

  defp normalize_source_info(_),
    do: {:error, GroupherServer.ErrorCat.custom("invalid sourceInfo contract")}

  defp validate_source_tree(%{
         "schemaVersion" => 2,
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

  defp validate_source_tree(_),
    do: {:error, GroupherServer.ErrorCat.custom("invalid SourceTree contract")}

  defp validate_source_nodes(_nodes, depth, _state) when depth > @max_depth,
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree exceeds depth #{@max_depth}")}

  defp validate_source_nodes(nodes, depth, state) when is_list(nodes) do
    Enum.reduce_while(nodes, {:ok, state}, &validate_source_node_step(&1, &2, depth))
  end

  defp validate_source_nodes(_nodes, _depth, _state),
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree pages must be a list")}

  defp validate_source_node_step(node, {:ok, current}, depth) do
    count = current.count + 1

    if count > @max_nodes do
      {:halt, {:error, GroupherServer.ErrorCat.custom("SourceTree exceeds #{@max_nodes} nodes")}}
    else
      case validate_source_node(node, depth, current, count) do
        {:ok, next} -> {:cont, {:ok, next}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end
  end

  defp validate_source_node(node, _depth, _current, _count) when not is_map(node),
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree contains an invalid node")}

  defp validate_source_node(node, depth, current, _count) do
    cond do
      not valid_text?(node["sourceId"]) or not valid_text?(node["title"]) ->
        {:error,
         GroupherServer.ErrorCat.custom("SourceTree node identity and title are required")}

      MapSet.member?(current.ids, node["sourceId"]) ->
        {:error, GroupherServer.ErrorCat.custom("SourceTree contains a duplicate sourceId")}

      true ->
        next = %{count: current.count + 1, ids: MapSet.put(current.ids, node["sourceId"])}
        validate_source_node_type(node, next, depth)
    end
  end

  defp validate_source_node_type(%{"type" => type, "pages" => pages}, next, depth)
       when type in ["scope", "section"],
       do: validate_source_nodes(pages, depth + 1, next)

  defp validate_source_node_type(
         %{"type" => "page", "route" => route, "sourcePath" => path},
         next,
         _depth
       )
       when is_binary(route) and is_binary(path),
       do: validate_source_page(route, path, next)

  defp validate_source_node_type(%{"type" => "link", "href" => href}, next, _depth)
       when is_binary(href),
       do: validate_source_link(href, next)

  defp validate_source_node_type(%{"type" => "page"}, _next, _depth),
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree page is invalid")}

  defp validate_source_node_type(%{"type" => "link"}, _next, _depth),
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree link is invalid")}

  defp validate_source_node_type(_node, _next, _depth),
    do: {:error, GroupherServer.ErrorCat.custom("SourceTree node type is invalid")}

  defp validate_source_page(route, path, next) do
    if valid_text?(route) and valid_text?(path),
      do: {:ok, next},
      else: {:error, GroupherServer.ErrorCat.custom("SourceTree page is invalid")}
  end

  defp validate_source_link(href, next) do
    if valid_text?(href),
      do: {:ok, next},
      else: {:error, GroupherServer.ErrorCat.custom("SourceTree link is invalid")}
  end

  defp validate_source_match(info, %{"source" => source}) do
    if info["framework"] == source["framework"] and
         info["content_root"] == source["root"] and
         info["config_paths"] == source["configPaths"] do
      :ok
    else
      {:error,
       GroupherServer.ErrorCat.custom("sourceInfo does not match the SourceTree source contract")}
    end
  end

  defp plan_target_tree(
         %{"source" => source, "navigation" => navigation},
         branch_slug,
         mapping_refs
       ) do
    scopes =
      if Enum.all?(navigation, &(&1["type"] == "scope")) do
        navigation
      else
        [
          %{
            "type" => "scope",
            "sourceId" => "inferred:default",
            "title" => "Introduction",
            "pages" => navigation
          }
        ]
      end

    %{
      "branchSlug" => branch_slug,
      "schemaVersion" => 2,
      "source" => source,
      "tabs" => Enum.map(scopes, &plan_scope(&1, branch_slug, mapping_refs))
    }
  end

  defp plan_scope(scope, branch_slug, mapping_refs) do
    direct = Enum.filter(scope["pages"], &(&1["type"] in ["page", "link"]))
    sections = Enum.filter(scope["pages"], &(&1["type"] == "section"))

    %{
      "sourceId" => scope["sourceId"],
      "title" => scope["title"],
      "groups" =>
        maybe_overview_group(scope, direct, branch_slug, mapping_refs) ++
          Enum.map(sections, &plan_node(&1, branch_slug, mapping_refs)),
      "pins" => []
    }
  end

  defp maybe_overview_group(_scope, [], _branch_slug, _mapping_refs), do: []

  defp maybe_overview_group(scope, pages, branch_slug, mapping_refs) do
    [
      %{
        "type" => "group",
        "sourceId" => "planned:#{scope["sourceId"]}:overview",
        "title" => "Overview",
        "pages" => Enum.map(pages, &plan_node(&1, branch_slug, mapping_refs))
      }
    ]
  end

  defp plan_node(%{"type" => "section"} = node, branch_slug, mapping_refs) do
    %{
      "type" => "group",
      "sourceId" => node["sourceId"],
      "title" => node["title"],
      "pages" => Enum.map(node["pages"], &plan_node(&1, branch_slug, mapping_refs))
    }
  end

  defp plan_node(%{"type" => "page"} = node, branch_slug, mapping_refs) do
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

  defp plan_node(%{"type" => "link"} = node, _branch_slug, _mapping_refs) do
    %{
      "type" => "link",
      "sourceId" => node["sourceId"],
      "title" => node["title"],
      "slug" => slug(node["title"]),
      "href" => node["href"]
    }
  end

  defp validate_target_tree(
         %{"branchSlug" => branch_slug, "schemaVersion" => 2, "tabs" => tabs},
         branch_slug,
         mapping_refs
       )
       when is_list(tabs) do
    tabs
    |> validate_target_tabs(branch_slug, mapping_refs)
    |> normalize_target_validation()
  end

  defp validate_target_tree(_, _, _),
    do:
      {:error,
       GroupherServer.ErrorCat.custom("confirmed TargetTree does not match source intent")}

  defp validate_target_tabs(tabs, branch_slug, mapping_refs) do
    Enum.reduce_while(tabs, {:ok, MapSet.new()}, fn tab, {:ok, ids} ->
      validate_target_tab(tab, branch_slug, mapping_refs, ids)
    end)
  end

  defp validate_target_tab(tab, branch_slug, mapping_refs, ids) do
    groups = tab["groups"]

    if is_map(tab) and is_list(groups) and valid_text?(tab["sourceId"]) and
         Enum.all?(groups, &(&1["type"] == "group")) do
      case validate_target_children(groups, branch_slug, mapping_refs, ids, 1) do
        {:ok, next} -> {:cont, {:ok, next}}
        error -> {:halt, error}
      end
    else
      {:halt,
       {:error, GroupherServer.ErrorCat.custom("confirmed TargetTree contains an invalid tab")}}
    end
  end

  defp normalize_target_validation({:ok, _ids}), do: :ok
  defp normalize_target_validation(error), do: error

  defp validate_target_children(_pages, _branch_slug, _mapping_refs, _ids, depth)
       when depth > @max_depth,
       do:
         {:error,
          GroupherServer.ErrorCat.custom("confirmed TargetTree exceeds depth #{@max_depth}")}

  defp validate_target_children(pages, branch_slug, mapping_refs, ids, depth) do
    Enum.reduce_while(pages, {:ok, ids}, fn child, {:ok, current} ->
      case validate_target_child(child, branch_slug, mapping_refs, current, depth) do
        {:ok, next} -> {:cont, {:ok, next}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp validate_target_child(child, _branch_slug, _mapping_refs, _ids, _depth)
       when not is_map(child),
       do:
         {:error,
          GroupherServer.ErrorCat.custom("confirmed TargetTree contains an invalid child")}

  defp validate_target_child(child, branch_slug, mapping_refs, ids, depth) do
    source_id = child["sourceId"]

    cond do
      not valid_text?(source_id) ->
        invalid_target_child()

      MapSet.member?(ids, source_id) ->
        duplicate_target_child()

      true ->
        validate_target_child_type(child, branch_slug, mapping_refs, ids, depth, source_id)
    end
  end

  defp validate_target_child_type(
         %{"type" => "group", "pages" => pages},
         branch_slug,
         mapping_refs,
         ids,
         depth,
         source_id
       )
       when is_list(pages),
       do:
         validate_target_children(
           pages,
           branch_slug,
           mapping_refs,
           MapSet.put(ids, source_id),
           depth + 1
         )

  defp validate_target_child_type(
         %{"type" => "page", "docId" => doc_id},
         branch_slug,
         mapping_refs,
         ids,
         _depth,
         source_id
       ) do
    if doc_id == Map.get(mapping_refs, source_id, target_ref(branch_slug, source_id)),
      do: {:ok, MapSet.put(ids, source_id)},
      else: invalid_target_intent()
  end

  defp validate_target_child_type(
         %{"type" => "link", "href" => href},
         _branch_slug,
         _mapping_refs,
         ids,
         _depth,
         source_id
       )
       when is_binary(href),
       do: validate_target_link(href, ids, source_id)

  defp validate_target_child_type(_child, _branch_slug, _mapping_refs, _ids, _depth, _source_id),
    do: invalid_target_intent()

  defp invalid_target_child,
    do: {:error, GroupherServer.ErrorCat.custom("confirmed TargetTree contains an invalid child")}

  defp duplicate_target_child,
    do:
      {:error,
       GroupherServer.ErrorCat.custom("confirmed TargetTree contains a duplicate sourceId")}

  defp invalid_target_intent,
    do: {:error, GroupherServer.ErrorCat.custom("confirmed TargetTree child intent is invalid")}

  defp validate_target_link(href, ids, source_id) do
    if valid_text?(href),
      do: {:ok, MapSet.put(ids, source_id)},
      else: invalid_target_intent()
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
      DocBranch
      |> where([branch], branch.community_id == ^community.id)
      |> where([branch], branch.slug == ^branch_slug)
      |> Repo.one()

    case branch do
      nil ->
        {"doc:#{branch_slug}:0", []}

      %DocBranch{} = branch ->
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
    nodes = Enum.flat_map(tabs, &collect_target_nodes(Map.get(&1, "groups", [])))

    %{
      assets: 0,
      groups: Enum.count(nodes, &(&1["type"] == "group")),
      links: Enum.count(nodes, &(&1["type"] == "link")),
      pages: Enum.count(nodes, &(&1["type"] == "page")),
      tabs: length(tabs)
    }
  end

  defp collect_target_nodes(pages) do
    Enum.flat_map(pages, fn child ->
      [
        child
        | if(child["type"] == "group", do: collect_target_nodes(child["pages"]), else: [])
      ]
    end)
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
      _ -> {:error, GroupherServer.ErrorCat.custom("#{key} is required")}
    end
  end

  defp string_list(map, key) do
    case Map.get(map, key, Map.get(map, String.to_atom(key))) do
      values when is_list(values) ->
        if Enum.all?(values, &is_binary/1),
          do: {:ok, values},
          else: {:error, GroupherServer.ErrorCat.custom("#{key} must contain strings")}

      _ ->
        {:error, GroupherServer.ErrorCat.custom("#{key} must be a list")}
    end
  end

  defp valid_text?(value), do: is_binary(value) and value != ""
end
