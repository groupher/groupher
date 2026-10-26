defmodule Mix.Tasks.Cms.Command.Pipeline do
  @shortdoc "Report CMS Command cross-module call graph"

  @moduledoc """
  Builds the fail-closed call graph for CMS entry points.

      resolver/facade root
        -> public/private helper
          -> Command/pipeline or unresolved edge

  The report is separate from `mix cms.pipeline.check`, but every invocation
  enforces complete parsing, resolved edges and the command topology contract.
  """

  use Mix.Task

  alias GroupherServer.CommandPipeline
  alias GroupherServer.CMS

  alias CommandPipeline.{
    CompiledModules,
    GraphAnalyzer,
    ProjectPaths,
    RejectionPurity
  }

  @switches [check: :boolean, output: :string]
  @manifest "priv/pipeline_graph.json"
  @cms_adapter CMS.CommandPipelineAdapter

  @facades MapSet.new([
             GroupherServer.CMS.Articles,
             GroupherServer.CMS.Assets,
             GroupherServer.CMS.Comments,
             GroupherServer.CMS.Communities,
             GroupherServer.CMS.CommunityApplications,
             GroupherServer.CMS.Dashboard,
             GroupherServer.CMS.DocCover,
             GroupherServer.CMS.DocTree,
             CMS.Docs,
             CMS.FrontDesk,
             CMS.Interactions,
             CMS.Kanban,
             CMS.Press,
             CMS.Snapshot,
             CMS.Wallpaper,
             GroupherServer.AlertWall,
             GroupherServer.ReviewBot
           ])

  @internal_entry_modules MapSet.new([CMS.Articles.Maintenance])

  @doc "Builds a deterministic call graph report from the supplied Elixir source files."
  def build_report(files, contracts \\ %{}) when is_list(files) and is_map(contracts) do
    parsed = Enum.map(files, &parse_file/1)

    source_parse_errors =
      parsed
      |> Enum.filter(&match?({:error, _}, &1))
      |> Enum.map(fn {:error, error} -> error end)

    modules =
      parsed
      |> Enum.flat_map(fn
        {:ok, values} -> values
        {:error, _error} -> []
      end)
      |> Enum.map(&put_pipeline_contract(&1, contracts))

    graph = GraphAnalyzer.build(modules)
    modules = graph.modules
    expansion_errors = graph.expansion_errors
    functions = graph.functions
    function_keys = graph.function_keys
    edges = graph.edges

    modules
    |> Enum.flat_map(& &1.pipelines)
    |> then(&RejectionPurity.validate!(graph, &1))

    candidate_roots = Enum.filter(functions, &root_function?/1)

    command_keys =
      functions
      |> Enum.filter(&(:command in &1.roles))
      |> MapSet.new(&function_key/1)

    relevant_keys = reverse_reachable_keys(command_keys, edges, function_keys)

    root_functions =
      Enum.filter(candidate_roots, &MapSet.member?(relevant_keys, function_key(&1)))

    root_keys = MapSet.new(root_functions, &function_key/1)

    user_root_keys =
      root_functions
      |> Enum.reject(&internal_root?/1)
      |> MapSet.new(&function_key/1)

    pipeline_contracts =
      modules
      |> Enum.flat_map(& &1.pipelines)
      |> Map.new(fn contract ->
        {{contract.module, contract.name, contract.arity}, contract}
      end)

    all_pipeline_keys =
      functions
      |> Enum.filter(&(&1.kind in [:receipt_pipeline, :direct_pipeline]))
      |> MapSet.new(&function_key/1)

    cms_pipeline_keys = MapSet.new(Map.keys(pipeline_contracts))

    non_cms_pipeline_keys = MapSet.difference(all_pipeline_keys, cms_pipeline_keys)

    traversal_edges = Enum.reject(edges, &MapSet.member?(non_cms_pipeline_keys, &1.from))

    reachable_keys = reachable_keys(root_keys, traversal_edges, function_keys)
    user_reachable_keys = reachable_keys(user_root_keys, traversal_edges, function_keys)
    reachable_edges = Enum.filter(traversal_edges, &MapSet.member?(reachable_keys, &1.from))
    reachable_unresolved = unresolved_edges(reachable_edges)
    reachable_modules = MapSet.new(reachable_keys, &elem(&1, 0))

    parse_errors =
      source_parse_errors ++
        (expansion_errors
         |> Enum.filter(&MapSet.member?(reachable_modules, &1.module))
         |> Enum.map(&Map.delete(&1, :module)))

    reached_pipeline_keys =
      pipeline_contracts
      |> Map.keys()
      |> Enum.filter(&MapSet.member?(reachable_keys, &1))
      |> Enum.sort()

    reached_pipelines = Enum.map(reached_pipeline_keys, &Map.fetch!(pipeline_contracts, &1))

    unreached_user_pipelines =
      pipeline_contracts
      |> Map.values()
      |> Enum.filter(&(&1.access == :user))
      |> Enum.reject(&MapSet.member?(user_reachable_keys, {&1.module, &1.name, &1.arity}))
      |> Enum.sort_by(&{Atom.to_string(&1.module), &1.name, &1.arity})

    internal_root_keys =
      root_functions
      |> Enum.filter(&internal_root?/1)
      |> MapSet.new(&function_key/1)

    internal_reachable_keys = reachable_keys(internal_root_keys, traversal_edges, function_keys)

    unreached_internal_pipelines =
      pipeline_contracts
      |> Map.values()
      |> Enum.filter(&(&1.access == :internal))
      |> Enum.reject(&MapSet.member?(internal_reachable_keys, {&1.module, &1.name, &1.arity}))
      |> Enum.sort_by(&{Atom.to_string(&1.module), &1.name, &1.arity})

    internal_violations =
      reached_pipelines
      |> Enum.filter(fn contract ->
        contract.access == :internal and
          MapSet.member?(user_reachable_keys, {contract.module, contract.name, contract.arity})
      end)
      |> Enum.map(&pipeline_violation(&1, reachable_edges, modules))

    legacy_commands =
      modules
      |> Enum.filter(&MapSet.member?(reachable_modules, module_key(&1)))
      |> Enum.filter(&(:command in &1.roles and &1.pipelines == []))
      |> Enum.map(&module_manifest/1)

    pipeline_function_kinds =
      functions
      |> Enum.filter(&(&1.kind in [:receipt_pipeline, :direct_pipeline]))
      |> Enum.filter(&Map.has_key?(pipeline_contracts, function_key(&1)))
      |> Map.new(&{function_key(&1), &1.kind})

    top_level_pipeline_calls =
      transitive_top_level_pipeline_calls(
        reachable_keys,
        reachable_edges,
        function_keys,
        pipeline_function_kinds
      )

    unpipelined_command_writes =
      unpipelined_command_writes(
        functions,
        root_keys,
        reachable_edges,
        function_keys,
        pipeline_function_kinds
      )

    stage_scopes = GraphAnalyzer.pipeline_stage_calls(graph, Map.values(pipeline_contracts))
    stage_analysis_errors = stage_analysis_errors(stage_scopes, Map.values(pipeline_contracts))
    gate_stage_violations = gate_stage_violations(graph, stage_scopes)

    mixed_protocol_entries =
      mixed_protocol_entries(functions, traversal_edges, function_keys, pipeline_function_kinds)

    unresolved_count = length(reachable_unresolved)
    parse_error_count = length(parse_errors)

    %{
      "analysis_status" =>
        if(parse_error_count == 0 and unresolved_count == 0 and stage_analysis_errors == [],
          do: "complete",
          else: "incomplete"
        ),
      "edges" => reachable_edges |> Enum.sort_by(&edge_sort_key/1) |> Enum.map(&edge_manifest/1),
      "internal_pipeline_violations" => internal_violations,
      "gate_stage_violations" => gate_stage_violations,
      "stage_analysis_errors" => stage_analysis_errors,
      "legacy_commands_reached" => legacy_commands,
      "modules" =>
        modules |> Enum.sort_by(&Atom.to_string(&1.module)) |> Enum.map(&module_manifest/1),
      "parse_errors" => parse_errors,
      "pipelines_reached" => Enum.map(reached_pipelines, &contract_manifest/1),
      "roots" =>
        root_functions |> Enum.sort_by(&function_key/1) |> Enum.map(&function_manifest/1),
      "schema_version" => 4,
      "summary" => %{
        "gate_stage_violations" => length(gate_stage_violations),
        "internal_pipeline_violations" => length(internal_violations),
        "legacy_commands_reached" => length(legacy_commands),
        "mixed_protocol_entries" => length(mixed_protocol_entries),
        "stage_analysis_errors" => length(stage_analysis_errors),
        "pipelines_reached" => length(reached_pipelines),
        "reachable_edges" => length(reachable_edges),
        "reachable_roots" => length(root_functions),
        "top_level_pipeline_calls" => length(top_level_pipeline_calls),
        "unpipelined_command_writes" => length(unpipelined_command_writes),
        "unreached_internal_pipelines" => length(unreached_internal_pipelines),
        "unreached_user_pipelines" => length(unreached_user_pipelines),
        "unresolved_edges" => unresolved_count
      },
      "top_level_pipeline_calls" => Enum.map(top_level_pipeline_calls, &edge_manifest/1),
      "mixed_protocol_entries" => mixed_protocol_entries,
      "unpipelined_command_writes" => Enum.map(unpipelined_command_writes, &edge_manifest/1),
      "unreached_internal_pipelines" =>
        Enum.map(unreached_internal_pipelines, &contract_manifest/1),
      "unreached_user_pipelines" => Enum.map(unreached_user_pipelines, &contract_manifest/1),
      "unresolved_edges" => Enum.map(reachable_unresolved, &unresolved_manifest/1)
    }
  end

  @impl true
  def run(args) do
    Mix.Task.run("compile", [])
    {opts, _argv, invalid} = OptionParser.parse(args, strict: @switches)

    if invalid != [] do
      Mix.raise("invalid options: #{inspect(invalid)}")
    end

    report = build_current_report()
    validate_report!(report)

    path = ProjectPaths.expand(Keyword.get(opts, :output, @manifest))
    json = Jason.encode!(report, pretty: true) <> "\n"

    if Keyword.get(opts, :check, false) do
      Mix.shell().info("CMS pipeline graph is valid: #{summary_line(report)}")
    else
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, json)
      Mix.shell().info("Wrote CMS pipeline graph: #{path}")
      Mix.shell().info(summary_line(report))
    end
  end

  @doc "Builds the current production CMS command graph without writing a report file."
  def build_current_report do
    build_report(source_files(), pipeline_contracts())
  end

  defp source_files do
    ProjectPaths.lib_root()
    |> Path.join("**/*.ex")
    |> Path.wildcard()
    |> Enum.sort()
  end

  defp cms_module?(module) do
    inspect(module)
    |> then(
      &(String.starts_with?(&1, "GroupherServer.CMS.") or
          String.starts_with?(&1, "GroupherServer.AlertWall.") or
          String.starts_with?(&1, "GroupherServer.ReviewBot."))
    )
  end

  defp pipeline_contracts do
    CompiledModules.production()
    |> Enum.filter(fn module ->
      Code.ensure_loaded?(module) and function_exported?(module, :__pipeline_contracts__, 0)
    end)
    |> Map.new(fn module ->
      contracts =
        module.__pipeline_contracts__()
        |> Enum.map(&Map.put(&1, :module, module))
        |> Enum.filter(&(&1[:adapter] == @cms_adapter and cms_module?(module)))

      {module, contracts}
    end)
  end

  defp parse_file(file) do
    case File.read(file) do
      {:ok, source} ->
        case Code.string_to_quoted(source, columns: true, token_metadata: true) do
          {:ok, ast} ->
            {:ok, extract_modules(ast, file)}

          {:error, {line, error, token}} ->
            {:error,
             %{
               "file" => relative_source(file),
               "line" => line,
               "reason" => inspect({error, token})
             }}
        end

      {:error, reason} ->
        {:error,
         %{"file" => relative_source(file), "reason" => "read failed: #{inspect(reason)}"}}
    end
  end

  defp extract_modules(ast, file) do
    {_, modules} =
      Macro.prewalk(ast, [], fn
        {:defmodule, meta, [name_ast, opts]} = node, acc when is_list(opts) ->
          module = module_name(name_ast)
          body = Keyword.get(opts, :do, [])
          {node, [extract_module(module, body, file, meta) | acc]}

        node, acc ->
          {node, acc}
      end)

    Enum.reverse(modules)
  end

  defp extract_module(module, body, file, meta) do
    forms = block_forms(body)
    aliases = Map.put(aliases(forms, module), :__MODULE__, Module.split(module))

    roles = roles(module, file)

    functions =
      forms
      |> Enum.flat_map(&function_definition(&1, module, file, aliases))
      |> Enum.map(&Map.merge(&1, %{aliases: aliases, roles: roles}))

    roles =
      if command_source?(file) and
           Enum.any?(functions, &(&1.name == :execute and &1.visibility == :public)) do
        [:command | roles]
      else
        roles
      end

    functions = Enum.map(functions, &Map.put(&1, :roles, roles))

    %{
      file: file,
      functions: functions,
      line: Keyword.get(meta, :line, 1),
      module: module,
      pipeline: nil,
      pipelines: [],
      roles: roles,
      uses: uses(forms, aliases)
    }
  end

  defp uses(forms, aliases) do
    forms
    |> Enum.flat_map(fn
      {:use, meta, [module_ast | _opts]} ->
        case resolve_module(module_ast, aliases) do
          nil -> [%{line: Keyword.get(meta, :line, 1), module: nil}]
          module -> [%{line: Keyword.get(meta, :line, 1), module: module}]
        end

      _form ->
        []
    end)
  end

  defp block_forms({:__block__, _meta, forms}), do: forms
  defp block_forms(form), do: [form]

  defp aliases(forms, module) do
    Enum.reduce(forms, %{:__MODULE__ => Module.split(module)}, fn
      {:alias, _meta, [target, opts]}, acc when is_list(opts) ->
        Map.merge(acc, Map.new(alias_entries(target, opts, module, acc)))

      {:alias, _meta, [target]}, acc ->
        Map.merge(acc, Map.new(alias_entries(target, [], module, acc)))

      _form, acc ->
        acc
    end)
  end

  defp alias_entries(target, opts, module, aliases) do
    alias_targets(target)
    |> Enum.map(&normalize_alias_parts(&1, module))
    |> Enum.map(&expand_alias_parts(&1, aliases))
    |> Enum.map(fn parts -> {alias_name(parts, opts), parts} end)
  end

  defp normalize_alias_parts([{:__MODULE__, _meta, _value} | rest], module) do
    Module.split(module) ++ rest
  end

  defp normalize_alias_parts(parts, _module), do: parts

  defp expand_alias_parts([first | rest], aliases) when is_atom(first) do
    case Map.get(aliases, first) do
      nil -> [first | rest]
      prefix -> prefix ++ rest
    end
  end

  defp expand_alias_parts(parts, _aliases), do: parts

  defp alias_targets({:__aliases__, _meta, parts}), do: [parts]

  defp alias_targets(
         {{:., _meta, [{:__aliases__, _prefix_meta, prefix}, :{}]}, _dot_meta, children}
       ) do
    Enum.map(children, fn
      {:__aliases__, _meta, child} -> prefix ++ child
      child when is_atom(child) -> prefix ++ [child]
    end)
  end

  defp alias_targets(
         {{:., _meta, [{:__MODULE__, _module_meta, _value}, :{}]}, _dot_meta, children}
       ) do
    Enum.map(children, fn
      {:__aliases__, _meta, child} -> [{:__MODULE__, [], nil} | child]
      child when is_atom(child) -> [{:__MODULE__, [], nil}, child]
    end)
  end

  defp alias_targets(_target), do: []

  defp alias_name(parts, opts) do
    case Keyword.get(opts, :as) do
      {:__aliases__, _meta, as_parts} -> List.last(as_parts)
      as when is_atom(as) and not is_nil(as) -> as
      _ -> List.last(parts)
    end
  end

  defp function_definition({kind, meta, [head, opts]}, module, file, aliases)
       when kind in [:def, :defp, :defmacro, :defmacrop, :defdelegate] and is_list(opts) do
    case function_head(head) do
      {name, args} ->
        [
          %{
            arity: length(args),
            calls: [],
            delegate: delegate_target(kind, opts, name, length(args), aliases),
            file: file,
            kind: kind,
            line: Keyword.get(meta, :line, 1),
            module: module,
            name: name,
            visibility: if(kind in [:def, :defmacro, :defdelegate], do: :public, else: :private),
            body: Keyword.get(opts, :do)
          }
        ]

      nil ->
        []
    end
  end

  defp function_definition({kind, meta, [head, opts]}, module, file, aliases)
       when kind in [:receipt_pipeline, :direct_pipeline] and is_list(opts) do
    case function_head(head) do
      {name, args} ->
        [
          %{
            arity: length(args),
            calls: [],
            delegate: nil,
            file: file,
            kind: kind,
            line: Keyword.get(meta, :line, 1),
            module: module,
            name: name,
            visibility: :public,
            body: Keyword.get(opts, :do),
            aliases: aliases
          }
        ]

      nil ->
        []
    end
  end

  defp function_definition(_form, _module, _file, _aliases), do: []

  defp function_head({:when, _meta, [head | _guards]}), do: function_head(head)
  defp function_head({name, _meta, args}) when is_atom(name) and is_list(args), do: {name, args}
  defp function_head(_head), do: nil

  defp delegate_target(:defdelegate, opts, name, arity, aliases) do
    case Keyword.get(opts, :to) do
      nil -> nil
      target -> {resolve_module(target, aliases), name, arity}
    end
  end

  defp delegate_target(_kind, _opts, _name, _arity, _aliases), do: nil

  defp put_pipeline_contract(module, contracts) do
    pipelines =
      contracts
      |> Map.get(module.module, [])
      |> Enum.map(&Map.put(&1, :module, module.module))

    roles =
      if pipelines != [],
        do: Enum.uniq([:command | module.roles]),
        else: module.roles

    functions = Enum.map(module.functions, &Map.put(&1, :roles, roles))

    %{
      module
      | functions: functions,
        pipeline: List.first(pipelines),
        pipelines: pipelines,
        roles: roles
    }
  end

  defp reachable_keys(root_keys, edges, function_keys) do
    GraphAnalyzer.reachable_keys(root_keys, edges, function_keys)
  end

  @doc false
  def gate_stage_violations(graph, stage_scopes) do
    gate_modules =
      MapSet.new([
        GroupherServer.CMS.Gate,
        GroupherServer.CMS.Gate.Access,
        GroupherServer.CMS.Gate.Access.Query
      ])

    gate_targets =
      graph.functions
      |> Enum.filter(fn function ->
        MapSet.member?(gate_modules, function.module) and
          gate_admission_function?(function.name)
      end)
      |> MapSet.new(&function_key/1)

    stage_scopes
    |> Enum.flat_map(fn %{pipeline: pipeline, stage: stage, edges: stage_edges} ->
      roots =
        stage_edges
        |> Enum.filter(&match?({:static, _}, GraphAnalyzer.edge_type(&1)))
        |> Enum.map(& &1.to)
        |> MapSet.new()

      reachable = reachable_keys(roots, graph.edges, graph.function_keys)

      gate_targets
      |> MapSet.intersection(reachable)
      |> Enum.reject(fn _target -> stage == :gate end)
      |> Enum.map(fn target ->
        %{
          "pipeline" => function_manifest_by_key(pipeline),
          "stage" => stage_manifest(stage),
          "gate" => function_manifest_by_key(target)
        }
      end)
    end)
    |> Enum.sort_by(fn violation ->
      {inspect(violation["pipeline"]), violation["stage"], inspect(violation["gate"])}
    end)
  end

  defp gate_admission_function?(:access_check), do: true

  defp gate_admission_function?(function) do
    name = Atom.to_string(function)
    String.ends_with?(name, "_in_transaction")
  end

  @doc false
  def stage_analysis_errors(stage_scopes, contracts) do
    actual =
      stage_scopes
      |> Enum.group_by(& &1.pipeline, & &1.stage)
      |> Map.new(fn {pipeline, stages} -> {pipeline, MapSet.new(stages)} end)

    contracts
    |> Enum.flat_map(fn contract ->
      key = {contract.module, contract.name, contract.arity}

      expected = MapSet.new(contract.stages)

      found = Map.get(actual, key, MapSet.new())

      if expected == found do
        []
      else
        [
          %{
            "pipeline" => function_manifest_by_key(key),
            "expected" => expected |> Enum.map(&stage_manifest/1) |> Enum.sort(),
            "found" => found |> Enum.map(&stage_manifest/1) |> Enum.sort()
          }
        ]
      end
    end)
    |> Enum.sort_by(&inspect(&1["pipeline"]))
  end

  defp mixed_protocol_entries(functions, edges, function_keys, pipeline_function_kinds) do
    adjacency =
      edges
      |> Enum.filter(&match?({:static, _}, GraphAnalyzer.edge_type(&1)))
      |> Enum.group_by(& &1.from)

    top_level_keys =
      pipeline_function_kinds
      |> MapSet.new(&elem(&1, 0))

    functions
    |> Enum.filter(fn function ->
      :command in function.roles and
        function.kind not in [:receipt_pipeline, :direct_pipeline]
    end)
    |> Enum.uniq_by(&function_key/1)
    |> Enum.flat_map(fn function ->
      source = function_key(function)

      targets =
        reachable_pipeline_targets(source, adjacency, function_keys, top_level_keys)

      protocols =
        targets
        |> Enum.map(&Map.fetch!(pipeline_function_kinds, &1))
        |> MapSet.new()

      if MapSet.member?(protocols, :receipt_pipeline) and
           MapSet.member?(protocols, :direct_pipeline) do
        [
          %{
            "entry" => function_manifest(function),
            "pipelines" =>
              targets
              |> Enum.sort()
              |> Enum.map(fn target ->
                function_manifest_by_key(target)
                |> Map.put(
                  "pipeline",
                  Atom.to_string(Map.fetch!(pipeline_function_kinds, target))
                )
              end)
          }
        ]
      else
        []
      end
    end)
    |> Enum.sort_by(&inspect(&1["entry"]))
  end

  defp stage_manifest(stage), do: Atom.to_string(stage)

  defp reverse_reachable_keys(target_keys, edges, function_keys) do
    GraphAnalyzer.reverse_reachable_keys(target_keys, edges, function_keys)
  end

  defp edge_sort_key(edge), do: GraphAnalyzer.edge_sort_key(edge)
  defp edge_type(edge), do: GraphAnalyzer.edge_type(edge)
  defp function_key(function), do: GraphAnalyzer.function_key(function)
  defp module_key(module), do: module.module
  defp resolve_module(module, aliases), do: GraphAnalyzer.resolve_module(module, aliases)

  defp module_name({:__aliases__, _meta, parts}), do: Module.concat(parts)
  defp module_name(_name), do: nil

  defp roles(module, file) do
    relative = relative_source(file)
    roles = []
    roles = if String.contains?(relative, "/resolvers/"), do: [:resolver | roles], else: roles

    roles = if MapSet.member?(@facades, module), do: [:facade | roles], else: roles

    roles =
      if MapSet.member?(@internal_entry_modules, module),
        do: [:internal_entry | roles],
        else: roles

    roles
  end

  defp command_source?(file), do: String.contains?(relative_source(file), "/commands/")

  defp root_function?(function) do
    function.visibility == :public and
      Enum.any?(function.roles, &(&1 in [:resolver, :facade, :internal_entry]))
  end

  defp internal_root?(function) do
    :internal_entry in function.roles or
      String.ends_with?(Atom.to_string(function.name), "_internal") or
      String.ends_with?(Atom.to_string(function.name), "_operations")
  end

  defp transitive_top_level_pipeline_calls(
         reachable_keys,
         edges,
         function_keys,
         pipeline_function_kinds
       ) do
    top_level_keys =
      pipeline_function_kinds
      |> Enum.filter(fn {_key, kind} -> kind in [:receipt_pipeline, :direct_pipeline] end)
      |> Map.new()
      |> Map.keys()
      |> MapSet.new()

    adjacency =
      edges
      |> Enum.filter(&match?({:static, _}, edge_type(&1)))
      |> Enum.group_by(& &1.from)

    reachable_keys
    |> Enum.filter(&MapSet.member?(top_level_keys, &1))
    |> Enum.flat_map(fn source ->
      source
      |> reachable_pipeline_targets(adjacency, function_keys, top_level_keys)
      |> Enum.map(fn target -> %{from: source, to: target, kind: :transitive_call, line: nil} end)
    end)
    |> Enum.uniq_by(&{&1.from, &1.to})
    |> Enum.sort_by(&{inspect(&1.from), inspect(&1.to)})
  end

  defp unpipelined_command_writes(
         functions,
         root_keys,
         edges,
         function_keys,
         pipeline_function_kinds
       ) do
    top_level_keys =
      pipeline_function_kinds
      |> Enum.filter(fn {_key, kind} -> kind in [:receipt_pipeline, :direct_pipeline] end)
      |> Map.new()
      |> Map.keys()
      |> MapSet.new()

    adjacency =
      edges
      |> Enum.filter(&match?({:static, _}, edge_type(&1)))
      |> Enum.group_by(& &1.from)

    pre_pipeline_keys =
      reachable_without_pipeline(root_keys, adjacency, function_keys, top_level_keys)

    functions
    |> Enum.filter(fn function ->
      :command in function.roles and
        function.kind not in [:receipt_pipeline, :direct_pipeline] and
        MapSet.member?(pre_pipeline_keys, function_key(function))
    end)
    |> Enum.flat_map(fn function ->
      find_unpipelined_writes(
        function_key(function),
        adjacency,
        function_keys,
        top_level_keys
      )
    end)
    |> Enum.uniq_by(&{&1.from, &1.to})
    |> Enum.sort_by(&{inspect(&1.from), inspect(&1.to)})
  end

  defp reachable_without_pipeline(root_keys, adjacency, function_keys, top_level_keys) do
    do_reachable_without_pipeline(
      MapSet.to_list(root_keys),
      MapSet.new(),
      adjacency,
      function_keys,
      top_level_keys
    )
  end

  defp do_reachable_without_pipeline([], visited, _adjacency, _function_keys, _top_level_keys) do
    visited
  end

  defp do_reachable_without_pipeline(
         [key | rest],
         visited,
         adjacency,
         function_keys,
         top_level_keys
       ) do
    cond do
      MapSet.member?(visited, key) ->
        do_reachable_without_pipeline(rest, visited, adjacency, function_keys, top_level_keys)

      MapSet.member?(top_level_keys, key) ->
        do_reachable_without_pipeline(
          rest,
          MapSet.put(visited, key),
          adjacency,
          function_keys,
          top_level_keys
        )

      true ->
        next =
          adjacency
          |> Map.get(key, [])
          |> Enum.map(& &1.to)
          |> Enum.filter(&MapSet.member?(function_keys, &1))

        do_reachable_without_pipeline(
          rest ++ next,
          MapSet.put(visited, key),
          adjacency,
          function_keys,
          top_level_keys
        )
    end
  end

  defp find_unpipelined_writes(source, adjacency, function_keys, top_level_keys) do
    do_find_unpipelined_writes(
      [source],
      source,
      MapSet.new(),
      adjacency,
      function_keys,
      top_level_keys,
      []
    )
  end

  defp do_find_unpipelined_writes(
         [],
         _source,
         _visited,
         _adjacency,
         _function_keys,
         _top_level_keys,
         found
       ) do
    found
  end

  defp do_find_unpipelined_writes(
         [key | rest],
         source,
         visited,
         adjacency,
         function_keys,
         top_level_keys,
         found
       ) do
    if MapSet.member?(visited, key) do
      do_find_unpipelined_writes(
        rest,
        source,
        visited,
        adjacency,
        function_keys,
        top_level_keys,
        found
      )
    else
      {next, writes} =
        adjacency
        |> Map.get(key, [])
        |> Enum.reduce({[], found}, fn edge, {next, writes} ->
          cond do
            MapSet.member?(top_level_keys, edge.to) ->
              {next, writes}

            write_boundary?(edge.to) ->
              {next,
               [%{from: source, to: edge.to, kind: :unpipelined_write, line: edge.line} | writes]}

            MapSet.member?(function_keys, edge.to) and elem(edge.to, 0) == elem(source, 0) ->
              {[edge.to | next], writes}

            true ->
              {next, writes}
          end
        end)

      do_find_unpipelined_writes(
        rest ++ next,
        source,
        MapSet.put(visited, key),
        adjacency,
        function_keys,
        top_level_keys,
        writes
      )
    end
  end

  defp write_boundary?({module, function, arity}) do
    module_name = inspect(module)

    (module == GroupherServer.Repo and
       repo_write?({function, arity})) or
      (module in [Helper.ORM, Helper.ORMAtom] and
         function in [:create, :delete, :update, :upsert]) or
      (module == Helper.Transaction and function in [:run, :transact]) or
      (String.contains?(module_name, ".Persist") and
         write_function?(function)) or
      (String.contains?(module_name, ".Store") and write_function?(function)) or
      (String.contains?(module_name, ".Workflow") and
         not String.contains?(module_name, ".ErrorCat.") and function not in [:get, :list]) or
      (String.contains?(module_name, ".Effects") and function not in [:get, :list]) or
      (String.contains?(module_name, ".Lifecycle") and
         function in [:ensure_created, :transition, :transition_by]) or
      (String.contains?(module_name, ".Trash") and
         function in [:trash, :restore, :permanently_delete, :create_action]) or
      (module == GroupherServer.CMS.Gate and function != :scope)
  end

  defp repo_write?({function, arity})
       when function in [:delete, :delete!, :insert, :insert!, :update, :update!] and
              arity in [1, 2] do
    true
  end

  defp repo_write?({function, arity})
       when function in [:delete_all, :insert_all, :update_all] and arity in [1, 2, 3] do
    true
  end

  defp repo_write?({:transaction, arity}) when arity in [1, 2], do: true
  defp repo_write?({:rollback, 1}), do: true
  defp repo_write?(_call), do: false

  defp write_function?(function) do
    function
    |> Atom.to_string()
    |> String.match?(
      ~r/^(create|insert|update|delete|remove|set|unset|replace|sync|persist|save|write|enqueue|transition)/
    )
  end

  defp reachable_pipeline_targets(source, adjacency, function_keys, top_level_keys) do
    next =
      adjacency
      |> Map.get(source, [])
      |> Enum.map(& &1.to)
      |> Enum.filter(&MapSet.member?(function_keys, &1))

    do_reachable_pipeline_targets(
      next,
      source,
      MapSet.new(),
      adjacency,
      function_keys,
      top_level_keys
    )
  end

  defp do_reachable_pipeline_targets(
         [],
         _source,
         _visited,
         _adjacency,
         _function_keys,
         _top_level_keys
       ) do
    []
  end

  defp do_reachable_pipeline_targets(
         [key | rest],
         source,
         visited,
         adjacency,
         function_keys,
         top_level_keys
       ) do
    cond do
      MapSet.member?(visited, key) ->
        do_reachable_pipeline_targets(
          rest,
          source,
          visited,
          adjacency,
          function_keys,
          top_level_keys
        )

      key != source and MapSet.member?(top_level_keys, key) ->
        [
          key
          | do_reachable_pipeline_targets(
              rest,
              source,
              MapSet.put(visited, key),
              adjacency,
              function_keys,
              top_level_keys
            )
        ]

      true ->
        next =
          adjacency
          |> Map.get(key, [])
          |> Enum.map(& &1.to)
          |> Enum.filter(&MapSet.member?(function_keys, &1))

        do_reachable_pipeline_targets(
          rest ++ next,
          source,
          MapSet.put(visited, key),
          adjacency,
          function_keys,
          top_level_keys
        )
    end
  end

  defp unresolved_edges(edges), do: Enum.filter(edges, &(edge_type(&1) == :unresolved))

  defp pipeline_violation(contract, edges, modules) do
    pipeline_key = {contract.module, contract.name, contract.arity}

    source =
      modules
      |> Enum.find(&(&1.module == contract.module))
      |> then(fn
        nil -> nil
        module -> relative_source(module.file)
      end)

    %{
      "access" => Atom.to_string(contract.access),
      "arity" => contract.arity,
      "function" => Atom.to_string(contract.name),
      "module" => inspect(contract.module),
      "source" => source,
      "reached_from" =>
        edges
        |> Enum.filter(&(&1[:to] == pipeline_key))
        |> Enum.map(&function_manifest_by_key(&1.from))
        |> Enum.uniq()
    }
  end

  defp function_manifest_by_key({module, name, arity}) do
    %{"arity" => arity, "function" => Atom.to_string(name), "module" => inspect(module)}
  end

  defp function_manifest(function) do
    Map.merge(function_manifest_by_key(function_key(function)), %{
      "file" => relative_source(function.file),
      "line" => function.line,
      "roles" => Enum.map(function.roles, &Atom.to_string/1)
    })
  end

  defp module_manifest(module) do
    %{
      "file" => relative_source(module.file),
      "module" => inspect(module.module),
      "pipeline" => pipeline_manifest(module.pipeline),
      "roles" => Enum.map(module.roles, &Atom.to_string/1)
    }
  end

  defp pipeline_manifest(nil), do: nil

  defp pipeline_manifest(contract) do
    %{
      "access" => contract[:access] && Atom.to_string(contract.access),
      "pipeline" => Atom.to_string(contract.pipeline),
      "operation" => contract[:operation] && Atom.to_string(contract.operation)
    }
  end

  defp contract_manifest(contract) do
    %{
      "access" => contract[:access] && Atom.to_string(contract.access),
      "arity" => contract.arity,
      "function" => Atom.to_string(contract.name),
      "pipeline" => Atom.to_string(contract.pipeline),
      "module" => inspect(contract.module),
      "operation" => contract[:operation] && Atom.to_string(contract.operation)
    }
  end

  defp edge_manifest(%{kind: kind, to: _to} = edge)
       when kind in [
              :local_call,
              :remote_call,
              :function_capture,
              :defdelegate,
              :transitive_call,
              :unpipelined_write
            ] do
    %{
      "from" => function_manifest_by_key(edge.from),
      "kind" => Atom.to_string(kind),
      "line" => edge.line,
      "to" => function_manifest_by_key(edge.to)
    }
  end

  defp edge_manifest(edge), do: unresolved_manifest(edge)

  defp unresolved_manifest(edge) do
    %{
      "file" => relative_source(function_file(edge.from)),
      "from" => function_manifest_by_key(edge.from),
      "kind" => Atom.to_string(edge.kind),
      "line" => edge.line,
      "reason" => edge.reason
    }
  end

  defp function_file({module, _name, _arity}) do
    if Code.ensure_loaded?(module) do
      case module.module_info(:compile)[:source] do
        source when is_list(source) -> List.to_string(source)
        source when is_binary(source) -> source
        _ -> ProjectPaths.root()
      end
    else
      ProjectPaths.root()
    end
  end

  @doc false
  def validate_report!(report) do
    summary = report["summary"]

    if report["parse_errors"] != [] or summary["unresolved_edges"] > 0 or
         summary["unreached_user_pipelines"] > 0 or
         summary["unreached_internal_pipelines"] > 0 or
         summary["internal_pipeline_violations"] > 0 or report["top_level_pipeline_calls"] != [] or
         report["legacy_commands_reached"] != [] or
         report["gate_stage_violations"] != [] or
         report["stage_analysis_errors"] != [] or
         report["mixed_protocol_entries"] != [] or
         report["unpipelined_command_writes"] != [] do
      Mix.raise("CMS pipeline graph is not proven: #{summary_line(report)}")
    end
  end

  defp summary_line(report) do
    summary = report["summary"]

    "roots=#{summary["reachable_roots"]}, edges=#{summary["reachable_edges"]}, pipelines=#{summary["pipelines_reached"]}, unreached-user=#{summary["unreached_user_pipelines"]}, unreached-internal=#{summary["unreached_internal_pipelines"]}, unresolved=#{summary["unresolved_edges"]}, internal=#{summary["internal_pipeline_violations"]}, top-level=#{summary["top_level_pipeline_calls"]}, stage-analysis=#{summary["stage_analysis_errors"]}, gate-stage=#{summary["gate_stage_violations"]}, mixed-protocol=#{summary["mixed_protocol_entries"]}, unpipelined=#{summary["unpipelined_command_writes"]}"
  end

  defp relative_source(source), do: ProjectPaths.relative(source)
end
