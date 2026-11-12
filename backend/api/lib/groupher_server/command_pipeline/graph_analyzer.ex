defmodule GroupherServer.CommandPipeline.GraphAnalyzer do
  @moduledoc """
  Builds the single compiled call graph used by pipeline topology and
  rejection-purity policies.

  It reads BEAM debug definitions, expands calls into resolved or explicitly
  unresolved edges, and owns fail-closed handling for dynamic calls, macros,
  default-argument trampolines, and missing local targets. Mix tasks consume
  this graph; they do not maintain separate source-level call models.

      compiled pipeline modules
        -> GraphAnalyzer
        -> functions and call edges
        -> topology and rejection-purity policies
  """

  alias GroupherServer.CommandPipeline
  alias CommandPipeline.ProjectPaths

  @special_forms MapSet.new([
                   :__block__,
                   :__aliases__,
                   :__MODULE__,
                   :%,
                   :%{},
                   :<<>>,
                   :.,
                   :{},
                   :=,
                   :->,
                   :alias,
                   :case,
                   :cond,
                   :def,
                   :defdelegate,
                   :defexception,
                   :defimpl,
                   :defmacro,
                   :defmodule,
                   :defp,
                   :defprotocol,
                   :defstruct,
                   :defoverridable,
                   :fn,
                   :for,
                   :if,
                   :import,
                   :receive,
                   :require,
                   :rescue,
                   :try,
                   :unless,
                   :use,
                   :when,
                   :size,
                   :with
                 ])

  @allowed_macro_modules MapSet.new([
                           Kernel,
                           Kernel.Typespec,
                           GroupherServer.CommandPipeline
                         ])

  @trusted_dynamic_modules MapSet.new([
                             GroupherServer.Activity.Artiment,
                             GroupherServer.Activity.Event,
                             GroupherServer.CMS.Command,
                             GroupherServer.CMS.Outbox,
                             GroupherServer.CMS.SearchArtiments.Indexer,
                             GroupherServer.CMS.Wallpaper.Workflow,
                             GroupherServer.ErrorCat.Registry,
                             Helper.ORM,
                             Helper.ORMAtom,
                             Helper.Transaction
                           ])

  # These provider calls are deliberately module-injected, but the call site
  # is fixed and reviewed. Keep this allowlist at MFA granularity so unrelated
  # dynamic calls in the same module still fail closed.
  @trusted_dynamic_calls MapSet.new([
                           {GroupherServer.Analysis.Web.Provision,
                            :ensure_umami_website_id_locked, :create_website, 1},
                           # typed_extension/1 returns only the Article thread tables declared
                           # beside these callers; the stored type is selected by Article.thread.
                           {GroupherServer.CMS.Articles.WorkingCopy.Snapshotter,
                            :freeze_typed_fields, :changeset, 2},
                           {GroupherServer.CMS.Articles.WorkingCopy.Snapshotter,
                            :clone_typed_fields, :changeset, 2},
                           {GroupherServer.CMS.Articles.WorkingCopy.Store, :insert_typed_work,
                            :changeset, 2},
                           {GroupherServer.CMS.Articles.WorkingCopy.Store, :update_typed_work,
                            :changeset, 2},
                           # Flop schemas are validated before this callback is invoked.
                           {Helper.ORM.Pagi, :validate_schema_order, :__flop_schema__, 0}
                         ])

  # These functions intentionally use apply/3 behind a fixed, reviewed
  # boundary. Keep the exception at exact MFA granularity so apply/3 remains
  # fail-closed everywhere else, including rejection builders.
  @trusted_apply_functions MapSet.new([
                             {GroupherServer.CMS.Command, :execute, 2},
                             {GroupherServer.CMS.DocTree.Events, :normalize_node_type, 1},
                             {Helper.Multi, :new, 0},
                             {Helper.Multi, :run, 3}
                           ])

  @doc false
  def build(modules) when is_list(modules) do
    {modules, expansion_errors} = expand_compiled_modules(modules)
    macro_registry = macro_registry(modules)

    functions =
      modules
      |> Enum.flat_map(& &1.functions)
      |> Enum.map(&put_function_calls(&1, macro_registry))

    function_keys = MapSet.new(functions, &function_key/1)

    edges =
      functions
      |> Enum.flat_map(& &1.calls)
      |> resolve_local_calls(function_keys)

    %{
      edges: edges,
      expansion_errors: expansion_errors,
      function_keys: function_keys,
      functions: functions,
      macro_registry: macro_registry,
      modules: modules
    }
  end

  @doc false
  def build_modules(modules) when is_list(modules) do
    modules
    |> Enum.map(&compiled_module/1)
    |> build()
  end

  @doc false
  def reachable_keys(root_keys, edges, function_keys) do
    adjacency =
      edges
      |> Enum.filter(&match?({:static, _}, edge_type(&1)))
      |> Enum.group_by(& &1.from)

    do_reachable(MapSet.to_list(root_keys), MapSet.new(), adjacency, function_keys)
  end

  @doc false
  def reverse_reachable_keys(target_keys, edges, function_keys) do
    reverse_adjacency =
      edges
      |> Enum.filter(&match?({:static, _}, edge_type(&1)))
      |> Enum.group_by(& &1.to)

    do_reverse_reachable(
      MapSet.to_list(target_keys),
      MapSet.new(),
      reverse_adjacency,
      function_keys
    )
  end

  @doc false
  def edge_sort_key(edge) do
    {
      inspect(edge.from),
      inspect(Map.get(edge, :to)),
      Atom.to_string(edge.kind),
      edge.line
    }
  end

  @doc false
  def edge_type(%{kind: kind, to: _to})
      when kind in [:remote_call, :local_call, :defdelegate, :function_capture] do
    {:static, kind}
  end

  def edge_type(_edge), do: :unresolved

  @doc false
  def function_key(function), do: {function.module, function.name, function.arity}

  @doc false
  def pipeline_stage_calls(graph, contracts) when is_map(graph) and is_list(contracts) do
    functions = Map.new(graph.functions, &{function_key(&1), &1})

    contracts
    |> Enum.flat_map(fn contract ->
      key = {contract.module, contract.name, contract.arity}

      case Map.fetch(functions, key) do
        {:ok, function} -> stage_calls(function, graph)
        :error -> []
      end
    end)
  end

  defp compiled_module(module) do
    source = module.module_info(:compile)[:source]

    pipelines =
      if function_exported?(module, :__pipeline_contracts__, 0) do
        Enum.map(module.__pipeline_contracts__(), &Map.put(&1, :module, module))
      else
        []
      end

    %{
      file: source |> to_string() |> Path.expand(),
      functions: [],
      line: 1,
      module: module,
      pipeline: List.first(pipelines),
      pipelines: pipelines,
      roles: [],
      uses: []
    }
  end

  defp macro_registry(modules) do
    modules
    |> Enum.flat_map(fn module ->
      Enum.filter(module.functions, &(&1.kind in [:defmacro, :defmacrop]))
      |> Enum.map(&function_key/1)
    end)
    |> MapSet.new()
  end

  defp expand_compiled_modules(modules) do
    Enum.map_reduce(modules, [], fn module, errors ->
      case compiled_functions(module) do
        {:ok, functions} ->
          {%{module | functions: functions}, errors}

        :unavailable ->
          unsupported =
            module.uses
            |> Enum.reject(&MapSet.member?(@allowed_macro_modules, &1.module))
            |> Enum.map(fn use ->
              %{
                :module => module.module,
                "file" => relative_source(module.file),
                "line" => use.line,
                "reason" => "cannot prove expansion of use #{inspect(use.module)}"
              }
            end)

          {module, errors ++ unsupported}
      end
    end)
  end

  defp compiled_functions(module) do
    with true <- compiled_source_matches?(module),
         path when is_list(path) <- :code.which(module.module),
         {:ok, {_beam_module, [debug_info: debug_info]}} <-
           :beam_lib.chunks(path, [:debug_info]),
         {:debug_info_v1, backend, data} <- debug_info,
         {:ok, info} <- backend.debug_info(:elixir_v1, module.module, data, []) do
      pipeline_kinds =
        Map.new(module.pipelines, fn pipeline ->
          {{pipeline.name, pipeline.arity}, pipeline.pipeline}
        end)

      functions =
        info.definitions
        |> Enum.flat_map(&compiled_function(&1, module, pipeline_kinds))

      {:ok, functions}
    else
      _ -> :unavailable
    end
  end

  defp compiled_source_matches?(module) do
    with true <- Code.ensure_loaded?(module.module),
         source when is_list(source) or is_binary(source) <-
           module.module.module_info(:compile)[:source] do
      Path.expand(to_string(source)) == Path.expand(module.file)
    else
      _ -> false
    end
  end

  defp compiled_function({{name, arity}, kind, meta, clauses}, module, pipeline_kinds)
       when kind in [:def, :defp] do
    bodies = Enum.map(clauses, &elem(&1, 3))

    [
      %{
        aliases: %{},
        arity: arity,
        body: {:__block__, [], bodies},
        calls: [],
        delegate: nil,
        file: module.file,
        kind: Map.get(pipeline_kinds, {name, arity}, kind),
        line: Keyword.get(meta, :line, module.line),
        module: module.module,
        name: name,
        roles: module.roles,
        visibility: if(kind == :def, do: :public, else: :private)
      }
    ]
  end

  defp compiled_function(_definition, _module, _pipeline_kinds), do: []

  defp put_function_calls(function, macro_registry) do
    calls =
      cond do
        function.delegate -> [static_edge(function, function.delegate, :defdelegate)]
        function.body -> calls_from(function.body, function, macro_registry)
        true -> []
      end

    %{function | calls: calls}
  end

  defp calls_from(body, function, macro_registry) do
    {_, calls} =
      Macro.prewalk(body, [], fn node, acc ->
        case call_edge(node, function, macro_registry) do
          nil -> {node, acc}
          call -> {node, [call | acc]}
        end
      end)

    Enum.reverse(calls)
  end

  defp stage_calls(function, graph) do
    function.body
    |> runner_stage_callbacks()
    |> Enum.map(fn {stage, callback} ->
      %{
        edges:
          callback
          |> calls_from(function, graph.macro_registry)
          |> resolve_local_calls(graph.function_keys),
        pipeline: function_key(function),
        stage: stage
      }
    end)
  end

  defp runner_stage_callbacks(body) do
    {_, callbacks} =
      Macro.prewalk(body, [], fn
        {{:., _dot_meta, [module_ast, function]}, _meta, args} = node, callbacks
        when function in [:run_receipt, :run_direct] and is_list(args) ->
          if resolve_module(module_ast, %{}) ==
               GroupherServer.CommandPipeline.Runner do
            {node, callbacks ++ callback_list(args)}
          else
            {node, callbacks}
          end

        node, callbacks ->
          {node, callbacks}
      end)

    callbacks
  end

  defp callback_list(args) do
    Enum.find_value(args, [], fn
      callbacks when is_list(callbacks) ->
        if callbacks != [] and Enum.all?(callbacks, &callback_pair?/1), do: callbacks

      _other ->
        nil
    end)
  end

  defp callback_pair?({stage, callback}) when is_atom(stage) do
    match?({:fn, _, _}, callback) or match?({:&, _, _}, callback)
  end

  defp callback_pair?(_pair), do: false

  defp call_edge(
         {{:., call_meta, [module_ast, name]}, meta, args} = node,
         function,
         macro_registry
       )
       when is_atom(name) and is_list(args) do
    if (Keyword.get(meta, :no_parens, false) or Keyword.get(call_meta, :no_parens, false)) and
         args == [] and is_nil(resolve_module(module_ast, function.aliases || %{})) do
      nil
    else
      case resolve_module(module_ast, function.aliases || %{}) do
        nil ->
          if MapSet.member?(@trusted_dynamic_modules, function.module) or
               MapSet.member?(
                 @trusted_dynamic_calls,
                 {function.module, function.name, name, length(args)}
               ) or
               adapter_dispatch?(node, function) do
            nil
          else
            unresolved_edge(function, meta, "dynamic module call", :dynamic_call)
          end

        :erlang when name == :apply and length(args) == 3 ->
          trusted_apply_or_unresolved(function, meta)

        module ->
          if MapSet.member?(macro_registry, {module, name, length(args)}) and
               not MapSet.member?(@allowed_macro_modules, module) do
            unresolved_edge(function, meta, "custom macro call", :custom_macro)
          else
            static_edge(function, {module, name, length(args)}, :remote_call, meta)
          end
      end
    end
  end

  defp call_edge({:&, _meta, [index]}, _function, _macro_registry) when is_integer(index) do
    nil
  end

  defp call_edge({:&, meta, [capture]}, function, macro_registry) do
    case capture_target(capture, function) do
      {module, _name, _arity} = target ->
        if MapSet.member?(macro_registry, target) and
             not MapSet.member?(@allowed_macro_modules, module) do
          unresolved_edge(function, meta, "custom macro capture", :custom_macro)
        else
          static_edge(function, target, :function_capture, meta)
        end

      nil ->
        if capture_placeholder?(capture) do
          nil
        else
          unresolved_edge(function, meta, "unresolved function capture", :function_capture)
        end
    end
  end

  defp call_edge({:super, meta, args}, function, _macro_registry) when is_list(args) do
    case Keyword.get(meta, :super) do
      {kind, name} when kind in [:def, :defp] and is_atom(name) ->
        static_edge(function, {function.module, name, length(args)}, :local_call, meta)

      _ ->
        unresolved_edge(function, meta, "unresolved super target", :dynamic_call)
    end
  end

  defp call_edge({name, meta, args}, function, _macro_registry)
       when is_atom(name) and is_list(args) do
    cond do
      MapSet.member?(@special_forms, name) ->
        nil

      Macro.operator?(name, length(args)) ->
        nil

      name == :apply and length(args) == 3 ->
        trusted_apply_or_unresolved(function, meta)

      name in [:spawn, :spawn_link, :spawn_monitor] ->
        unresolved_edge(function, meta, "runtime callback", :dynamic_call)

      true ->
        static_edge(function, {function.module, name, length(args)}, :local_call, meta)
    end
  end

  defp call_edge(_node, _function, _macro_registry), do: nil

  # The runner deliberately dispatches through the adapter selected by the
  # pipeline contract. This is the one generic boundary where the module is a
  # runtime value; adapter callbacks are validated at compile time and are not
  # business call-graph edges. Keep this allowlist exact so an unrelated
  # dynamic call in the runner remains fail-closed.
  defp adapter_dispatch?({{:., _, [{:adapter_for, _, _}, _name]}, _, _args}, function) do
    function.module == GroupherServer.CommandPipeline.Runner and
      function.name in [
        :run_receipt,
        :run_receipt_command,
        :run_direct_transaction,
        :rejection_log,
        :write_rejection
      ]
  end

  defp adapter_dispatch?({{:., _, [{:adapter, _, _}, _name]}, _, _args}, function) do
    function.module == GroupherServer.CommandPipeline.Runner and
      function.name in [:run_receipt, :rejection_log]
  end

  defp adapter_dispatch?(_node, _function), do: false

  defp trusted_apply_or_unresolved(function, meta) do
    if MapSet.member?(@trusted_apply_functions, function_key(function)) do
      nil
    else
      unresolved_edge(function, meta, "apply/3", :dynamic_call)
    end
  end

  defp capture_target(
         {:/, _meta, [{{:., _dot_meta, [module_ast, name]}, _call_meta, []}, arity]},
         function
       )
       when is_atom(name) and is_integer(arity) do
    case resolve_module(module_ast, function.aliases || %{}) do
      nil -> nil
      module -> {module, name, arity}
    end
  end

  defp capture_target({:/, _meta, [{name, _name_meta, context}, arity]}, function)
       when is_atom(name) and is_atom(context) and is_integer(arity) do
    {function.module, name, arity}
  end

  defp capture_target(_capture, _function), do: nil

  defp capture_placeholder?(capture) do
    {_, found?} =
      Macro.prewalk(capture, false, fn
        {:&, _meta, [index]} = node, _found when is_integer(index) -> {node, true}
        node, found -> {node, found}
      end)

    found?
  end

  defp static_edge(function, {module, name, arity}, kind, meta \\ []) do
    %{
      from: function_key(function),
      kind: kind,
      line: Keyword.get(meta, :line, function.line),
      to: {module, name, arity}
    }
  end

  defp unresolved_edge(function, meta, reason, kind) do
    %{
      from: function_key(function),
      kind: kind,
      line: Keyword.get(meta, :line, function.line),
      reason: reason
    }
  end

  defp resolve_local_calls(edges, function_keys) do
    Enum.flat_map(edges, fn edge ->
      if edge.kind == :local_call and not MapSet.member?(function_keys, edge.to) do
        {_module, name, arity} = edge.to

        if function_exported?(Kernel, name, arity) or macro_exported?(Kernel, name, arity) do
          []
        else
          [
            %{
              from: edge.from,
              kind: :unresolved_local_call,
              line: edge.line,
              reason: "local target #{name}/#{arity} is not defined"
            }
          ]
        end
      else
        [edge]
      end
    end)
  end

  @doc false
  def resolve_module({:__aliases__, _meta, parts}, aliases) do
    case parts do
      [{:__MODULE__, _meta, _value} | rest] ->
        Module.concat(Map.get(aliases, :__MODULE__, []) ++ rest)

      _ ->
        resolve_alias_parts(parts, aliases)
    end
  end

  def resolve_module(module, _aliases) when is_atom(module) and module not in [:__MODULE__] do
    module
  end

  def resolve_module(_module, _aliases), do: nil

  defp resolve_alias_parts(parts, aliases) do
    case Map.get(aliases, List.first(parts)) do
      nil -> Module.concat(parts)
      prefix -> Module.concat(prefix ++ Enum.drop(parts, 1))
    end
  end

  defp do_reverse_reachable([], visited, _adjacency, _function_keys), do: visited

  defp do_reverse_reachable([key | rest], visited, adjacency, function_keys) do
    if MapSet.member?(visited, key) do
      do_reverse_reachable(rest, visited, adjacency, function_keys)
    else
      previous =
        adjacency
        |> Map.get(key, [])
        |> Enum.map(& &1.from)
        |> Enum.filter(&MapSet.member?(function_keys, &1))

      do_reverse_reachable(rest ++ previous, MapSet.put(visited, key), adjacency, function_keys)
    end
  end

  defp do_reachable([], visited, _adjacency, _function_keys), do: visited

  defp do_reachable([key | rest], visited, adjacency, function_keys) do
    if MapSet.member?(visited, key) do
      do_reachable(rest, visited, adjacency, function_keys)
    else
      next =
        adjacency
        |> Map.get(key, [])
        |> Enum.map(& &1.to)
        |> Enum.filter(&MapSet.member?(function_keys, &1))

      do_reachable(rest ++ next, MapSet.put(visited, key), adjacency, function_keys)
    end
  end

  defp relative_source(source), do: ProjectPaths.relative(source)
end
