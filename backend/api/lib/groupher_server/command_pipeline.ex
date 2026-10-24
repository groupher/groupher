defmodule GroupherServer.CommandPipeline do
  @moduledoc """
  Compile-time declaration for Backend command pipelines.

  The declaration is intentionally small: a command still owns the private
  business functions, while this module owns the public execution order and
  the protocol selected by the command (`receipt_pipeline` or
  `direct_pipeline`). Complex domain workflows remain ordinary functions and
  modules called from the command's `change` stage.

      Command declaration
        -> pipeline macro
        -> ordered runner stages
        -> Gate / Lifecycle / Persist contract

  Receipt pipelines persist a confirmation so retries can recover the first
  committed result; direct pipelines execute once without a Receipt. For a
  real pair of both forms, see `CMS.Accounts.CollectFolders.Commands.Add`.

  ## Examples

      use GroupherServer.CommandPipeline,
        adapter: GroupherServer.CMS.CommandPipelineAdapter

      @pipeline operation: :collect_add,
                access: :user,
                target: :article,
                params: [:folder_id],
                confirmation: GroupherServer.Accounts.CollectFolders.MembershipConfirmation

      receipt_pipeline execute_receipt(article, folder_id, user, command_id) do
        gate(fn candidate -> prepare_gated_add(article, folder_id, user, command_id) end)
        change(fn prepared -> apply_add(prepared, article, user) end)
        confirm(fn folder -> confirmation(folder, article, folder_id, :add) end)
        present(fn receipt -> present_confirmation(receipt, command_id) end)
      end

  This excerpt follows `CMS.Accounts.CollectFolders.Commands.Add`; its named
  stage functions and confirmation codec are defined by that command.
  """

  alias GroupherServer.CommandPipeline
  alias CommandPipeline.Runner

  @stage_order [
    :prepare,
    :load,
    :gate,
    :lifecycle,
    :change,
    :confirm,
    :present,
    :on_rejection,
    :cleanup
  ]

  @doc """
  Imports the command-pipeline DSL and registers the adapter used by generated pipelines.

  `adapter:` is optional and defaults to `GroupherServer.CommandPipeline.DefaultAdapter`.
  CMS commands supply `CMS.CommandPipelineAdapter` to connect Receipt and CMS Gate behavior.
  """
  @spec __using__(keyword()) :: Macro.t()
  defmacro __using__(opts) do
    Module.register_attribute(__CALLER__.module, :pipeline, persist: false)

    adapter = Keyword.get(opts, :adapter, GroupherServer.CommandPipeline.DefaultAdapter)
    Module.register_attribute(__CALLER__.module, :pipeline_adapter, persist: true)
    Module.put_attribute(__CALLER__.module, :pipeline_adapter, adapter)

    Module.register_attribute(__CALLER__.module, :pipeline_contracts,
      accumulate: true,
      persist: true
    )

    quote do
      import GroupherServer.CommandPipeline,
        only: [
          receipt_pipeline: 2,
          direct_pipeline: 2,
          prepare: 1,
          load: 1,
          gate: 1,
          lifecycle: 1,
          change: 1,
          confirm: 1,
          present: 1,
          on_rejection: 1,
          cleanup: 1
        ]

      @before_compile GroupherServer.CommandPipeline
    end
  end

  @doc """
  Declares a retry-safe pipeline whose confirm stage persists a Receipt result.

  The `@pipeline` metadata must identify operation, actor, target, Receipt
  parameters, and confirmation codec. See the complete module example above.
  """
  @spec receipt_pipeline(Macro.t(), Macro.t()) :: Macro.t()
  defmacro receipt_pipeline(head, do: body) do
    build_pipeline(__CALLER__, :receipt_pipeline, head, body)
  end

  @doc """
  Declares a direct pipeline with Gate/Lifecycle/write stages and no Receipt recovery.

  Use this only when the operation has no retry/replay contract. For a concrete
  direct path paired with a receipt path, see `CMS.Accounts.CollectFolders.Commands.Add.run_direct/3`.
  """
  @spec direct_pipeline(Macro.t(), Macro.t()) :: Macro.t()
  defmacro direct_pipeline(head, do: body) do
    build_pipeline(__CALLER__, :direct_pipeline, head, body)
  end

  @doc "Compile-time hook that validates declarations and generates pipeline contract functions."
  @spec __before_compile__(Macro.Env.t()) :: Macro.t()
  defmacro __before_compile__(env) do
    contracts = Module.get_attribute(env.module, :pipeline_contracts) || []
    contracts = Enum.reverse(contracts)
    validate_compiled_contracts!(contracts, env.module)

    clauses =
      Enum.map(contracts, fn contract ->
        quote do
          def __pipeline_contract__(unquote(contract.name)), do: unquote(Macro.escape(contract))
        end
      end)

    quote do
      @doc false
      def __pipeline_contracts__, do: unquote(Macro.escape(contracts))
      unquote_splicing(clauses)
    end
  end

  # Stage macros exist only so the quoted body has a stable, readable shape if
  # a caller accidentally expands it before the outer pipeline macro consumes
  # it. The outer macro removes all stage calls from the generated function.
  @doc "Declares an input-normalization stage that runs before loading or authorization."
  defmacro prepare(value), do: value

  @doc "Declares the canonical resource-loading stage for the pipeline."
  defmacro load(value), do: value

  @doc "Declares the authorization stage; Gate transaction checks must run here."
  defmacro gate(value), do: value

  @doc "Declares the Lifecycle transition stage for an authorized canonical resource."
  defmacro lifecycle(value), do: value

  @doc "Declares the domain change stage, after Gate and Lifecycle validation."
  defmacro change(value), do: value

  @doc "Declares Receipt confirmation construction; required by `receipt_pipeline`."
  defmacro confirm(value), do: value

  @doc "Declares the caller-facing projection stage after transaction work succeeds."
  defmacro present(value), do: value

  @doc "Declares explicit handling for a rejected Gate/Lifecycle result."
  defmacro on_rejection(value), do: value

  @doc "Declares cleanup that runs under the pipeline runner's rejection/finalization contract."
  defmacro cleanup(value), do: value

  defp build_pipeline(caller, pipeline_type, head, body) do
    {name, args} = function_head!(head, pipeline_type)
    forms = body_forms(body)
    stages = parse_stages!(forms, caller)
    validate_pipeline_structure!(pipeline_type, stages)
    rejection_builder = rejection_builder!(stages, caller)
    args_map = args_map_ast(args)
    adapter = pipeline_adapter(caller)
    stage_ast = stage_functions_ast(stages, adapter)
    arguments = Enum.map(args, &arg_name!/1)
    actor = actor_argument!(arguments, caller.module)
    command_id = command_id_argument!(pipeline_type, arguments, caller.module)

    quote do
      @pipeline_contracts %{
        pipeline: unquote(pipeline_type),
        module: __MODULE__,
        adapter: unquote(adapter),
        name: unquote(name),
        arity: unquote(length(args)),
        arguments: unquote(arguments),
        operation: @pipeline[:operation],
        confirmation: @pipeline[:confirmation],
        access: @pipeline[:access] || :user,
        actor: unquote(actor),
        command_id: unquote(command_id),
        operation_ref: @pipeline[:operation_ref],
        target: @pipeline[:target],
        params: @pipeline[:params],
        rejection_builder: unquote(Macro.escape(rejection_builder)),
        stages: unquote(Enum.map(stages, &elem(&1, 0)))
      }

      def unquote(name)(unquote_splicing(args)) do
        contract = __pipeline_contract__(unquote(name))
        input = Runner.build_input(unquote(args_map), contract)

        Runner.unquote(run_function(pipeline_type))(
          __MODULE__,
          contract,
          input,
          unquote(stage_ast)
        )
      end

      Module.delete_attribute(__MODULE__, :pipeline)
    end
  end

  defp run_function(:receipt_pipeline), do: :run_receipt
  defp run_function(:direct_pipeline), do: :run_direct

  defp pipeline_adapter(caller) do
    caller.module
    |> Module.get_attribute(:pipeline_adapter)
    |> Macro.expand(caller)
  end

  defp function_head!({:when, _meta, [head | _guards]}, pipeline_type) do
    raise ArgumentError,
          "#{pipeline_type} does not support guards in pipeline function heads: #{Macro.to_string(head)}"
  end

  defp function_head!({name, _meta, args}, pipeline_type) when is_atom(name) and is_list(args) do
    validate_function_args!(args, pipeline_type)
    {name, args}
  end

  defp function_head!(other, pipeline_type) do
    raise ArgumentError,
          "#{pipeline_type} expects a function head, got: #{Macro.to_string(other)}"
  end

  defp validate_function_args!(args, pipeline_type) do
    Enum.each(args, fn
      {name, _meta, context} when is_atom(name) and is_atom(context) and name != :_ ->
        {:ok, :pass}

      arg ->
        raise ArgumentError,
              "#{pipeline_type} only supports simple arguments; guards, defaults, and patterns are not supported: #{Macro.to_string(arg)}"
    end)
  end

  defp actor_argument!(arguments, module) do
    case Enum.filter([:actor, :user, :author], &(&1 in arguments)) do
      [actor] ->
        actor

      [] ->
        nil

      actors ->
        raise ArgumentError, "#{inspect(module)} pipeline actor is ambiguous: #{inspect(actors)}"
    end
  end

  defp command_id_argument!(:receipt_pipeline, arguments, module) do
    if :command_id in arguments do
      :command_id
    else
      raise ArgumentError, "#{inspect(module)} receipt_pipeline requires command_id argument"
    end
  end

  defp command_id_argument!(:direct_pipeline, _arguments, _module), do: nil

  defp arg_name!({name, _meta, context}) when is_atom(name) and is_atom(context) and name != :_ do
    name
  end

  defp body_forms({:__block__, _meta, forms}), do: forms
  defp body_forms(form), do: [form]

  defp parse_stages!(forms, caller) do
    Enum.map(forms, fn
      {stage, _meta, [callback]} when stage in @stage_order and stage not in [:step, :return] ->
        validate_callback!(stage, callback, caller)
        {stage, callback}

      {stage, _meta, args} when is_atom(stage) ->
        raise ArgumentError, "pipeline stage #{stage}/#{length(args)} has invalid syntax"

      other ->
        raise ArgumentError, "unknown pipeline form: #{Macro.to_string(other)}"
    end)
  end

  defp validate_pipeline_structure!(pipeline_type, stages) do
    names = Enum.map(stages, &elem(&1, 0))

    if length(names) != length(Enum.uniq(names)) do
      raise(ArgumentError, "pipeline stages must be unique")
    end

    indexes = Enum.map(names, &Enum.find_index(@stage_order, fn stage -> stage == &1 end))

    unless indexes == Enum.sort(indexes) do
      raise(ArgumentError, "pipeline stages must be declared in execution order")
    end

    if pipeline_type == :receipt_pipeline and :confirm not in names do
      raise(ArgumentError, "receipt_pipeline requires confirm")
    end

    if :load in names and :gate in names do
      raise(ArgumentError, "load and gate are mutually exclusive")
    end
  end

  defp rejection_builder!(stages, caller) do
    case Keyword.get(stages, :on_rejection) do
      nil ->
        nil

      callback ->
        case local_capture(callback) do
          {name, 1} ->
            {caller.module, name, 1}

          _ ->
            raise ArgumentError,
                  "on_rejection must use a local function capture such as &build_rejection/1"
        end
    end
  end

  defp local_capture({:&, _meta, [{:/, _capture_meta, [{name, _name_meta, context}, 1]}]})
       when is_atom(name) and (is_atom(context) or is_nil(context)) do
    {name, 1}
  end

  defp local_capture(_callback), do: nil

  defp validate_compiled_contracts!(contracts, module) do
    Enum.each(contracts, fn contract ->
      unless is_atom(contract.operation) do
        raise(
          ArgumentError,
          "#{inspect(module)} #{contract.pipeline} requires @pipeline operation"
        )
      end

      unless contract.access in [:user, :internal, :open] do
        raise(
          ArgumentError,
          "#{inspect(module)} @pipeline access must be :user, :internal, or :open"
        )
      end

      validate_target!(contract, module)
      validate_argument_reference!(contract, module, :operation_ref)

      if contract.pipeline == :receipt_pipeline and is_nil(contract.params) do
        raise(ArgumentError, "#{inspect(module)} receipt_pipeline requires params")
      end

      if contract.access == :user and :gate not in contract.stages do
        raise(ArgumentError, "#{inspect(module)} user pipeline requires gate")
      end

      if contract.access == :user and is_nil(contract.actor) do
        raise(
          ArgumentError,
          "#{inspect(module)} user pipeline requires actor/user/author argument"
        )
      end

      if contract.access == :open and :gate in contract.stages do
        raise(ArgumentError, "#{inspect(module)} open pipeline cannot declare gate")
      end

      if contract.access == :open and :on_rejection in contract.stages and is_nil(contract.actor) do
        raise(
          ArgumentError,
          "#{inspect(module)} open pipeline with on_rejection requires actor/user/author argument"
        )
      end

      if :change not in contract.stages do
        raise(ArgumentError, "#{inspect(module)} pipeline requires change")
      end

      if contract.pipeline == :receipt_pipeline and not is_atom(contract.confirmation) do
        raise(ArgumentError, "#{inspect(module)} receipt_pipeline requires confirmation")
      end

      if contract.pipeline == :direct_pipeline and
           (:confirm in contract.stages or not is_nil(contract.confirmation)) do
        raise(
          ArgumentError,
          "#{inspect(module)} direct_pipeline cannot declare confirmation or confirm"
        )
      end

      validate_adapter!(contract, module)

      validate_rejection_builder!(contract, module)
    end)
  end

  defp validate_adapter!(contract, module) do
    adapter = contract.adapter

    unless is_atom(adapter) do
      raise ArgumentError,
            "#{inspect(module)} pipeline adapter is not available: #{inspect(adapter)}"
    end

    case Code.ensure_compiled(adapter) do
      {:module, _adapter} ->
        {:ok, :pass}

      {:error, reason} ->
        raise ArgumentError,
              "#{inspect(module)} pipeline adapter is not available: #{inspect(adapter)} (#{inspect(reason)})"
    end

    required =
      [
        :validate_contract,
        :normalize_gate_result,
        :normalize_transaction_error,
        :normalize_source,
        :valid_source?,
        :record_rejection
      ]
      |> Kernel.++(
        if(contract.pipeline == :receipt_pipeline,
          do: [:validate_command_id, :execute_receipt],
          else: []
        )
      )

    missing = Enum.reject(required, &function_exported?(adapter, &1, adapter_arity(&1)))

    if missing != [] do
      raise ArgumentError,
            "#{inspect(module)} pipeline adapter #{inspect(adapter)} is missing #{inspect(missing)}"
    end

    case adapter.validate_contract(contract) do
      {:ok, :pass} ->
        {:ok, :pass}

      {:error, reason} ->
        raise ArgumentError,
              "#{inspect(module)} pipeline contract rejected by #{inspect(adapter)}: #{inspect(reason)}"

      other ->
        raise ArgumentError,
              "#{inspect(module)} pipeline adapter #{inspect(adapter)} returned invalid contract validation: #{inspect(other)}"
    end
  end

  defp adapter_arity(:validate_contract), do: 1
  defp adapter_arity(:validate_command_id), do: 1
  defp adapter_arity(:execute_receipt), do: 5
  defp adapter_arity(:normalize_gate_result), do: 1
  defp adapter_arity(:normalize_transaction_error), do: 1
  defp adapter_arity(:normalize_source), do: 1
  defp adapter_arity(:valid_source?), do: 1
  defp adapter_arity(:record_rejection), do: 1

  defp validate_rejection_builder!(%{stages: stages, rejection_builder: nil}, _module) do
    if :on_rejection in stages do
      raise(ArgumentError, "on_rejection requires a local builder")
    end
  end

  defp validate_rejection_builder!(
         %{stages: stages, rejection_builder: {builder_module, name, arity}},
         module
       ) do
    if :on_rejection not in stages do
      raise ArgumentError, "rejection_builder metadata requires on_rejection"
    end

    unless builder_module == module and Module.defines?(module, {name, arity}, :defp) do
      raise ArgumentError,
            "#{inspect(module)} on_rejection builder must be a private defp #{name}/#{arity}"
    end
  end

  defp validate_target!(contract, module) do
    target = contract[:target]

    cond do
      is_nil(target) ->
        raise ArgumentError, "#{inspect(module)} #{contract.pipeline} requires @pipeline target"

      not is_atom(target) ->
        raise ArgumentError, "#{inspect(module)} @pipeline target must be an argument name atom"

      target not in Map.get(contract, :arguments, []) ->
        raise ArgumentError,
              "#{inspect(module)} @pipeline target #{inspect(target)} is not a function argument"

      true ->
        {:ok, :pass}
    end
  end

  defp validate_argument_reference!(contract, module, key) do
    case Map.get(contract, key) do
      nil ->
        {:ok, :pass}

      argument when is_atom(argument) ->
        if argument in contract.arguments do
          {:ok, :pass}
        else
          raise ArgumentError,
                "#{inspect(module)} @pipeline #{key} #{inspect(argument)} is not a function argument"
        end

      argument ->
        raise ArgumentError,
              "#{inspect(module)} @pipeline #{key} #{inspect(argument)} is not a function argument"
    end
  end

  defp validate_callback!(stage, callback, caller, expected \\ nil) do
    arity = callback_arity(callback)
    expected = expected || if(stage in [:prepare, :load], do: 0, else: 1)

    unless arity == expected do
      raise ArgumentError, "#{stage} callback must have arity #{expected}, got #{inspect(arity)}"
    end

    _ = caller
    {:ok, :pass}
  end

  defp callback_arity({:fn, _meta, clauses}) do
    clauses
    |> Enum.map(fn
      {:->, _meta, [args, _body]} -> length(args)
      _ -> -1
    end)
    |> Enum.uniq()
    |> case do
      [arity] -> arity
      _ -> :multiple
    end
  end

  defp callback_arity({:&, _meta, [{:/, _capture_meta, [_function, arity]}]})
       when is_integer(arity) do
    arity
  end

  defp callback_arity(_), do: :unknown

  defp args_map_ast(args) do
    pairs =
      args
      |> Enum.with_index()
      |> Enum.map(fn {arg, index} -> {arg_key(arg, index), arg} end)
      |> Enum.reject(fn {_key, value} -> match?({:^, _, _}, value) end)

    quote do
      %{unquote_splicing(pairs)}
    end
  end

  defp arg_key({name, _meta, context}, _index) when is_atom(name) and is_atom(context), do: name
  defp arg_key(_arg, index), do: String.to_atom("arg#{index + 1}")

  defp stage_functions_ast(stages, adapter) do
    Enum.map(stages, fn
      {:gate, callback} ->
        {:gate,
         quote do
           fn value ->
             unquote(callback).(value)
             |> unquote(adapter).normalize_gate_result()
           end
         end}

      stage ->
        stage
    end)
  end
end
