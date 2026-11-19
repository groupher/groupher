defmodule GroupherServer.Test.PipelinePurityFixtures.PureBuilder do
  @moduledoc false

  def build(context), do: %{code: rejection_code(context)}
  defp rejection_code(%{error: error}), do: error
end

defmodule GroupherServer.Test.PipelinePurityFixtures.RemoteHelper do
  @moduledoc false

  def value(context), do: context
end

defmodule GroupherServer.Test.PipelinePurityFixtures.CrossModuleBuilder do
  @moduledoc false

  alias GroupherServer.CommandPipeline
  alias GroupherServer.Test
  alias Test.PipelinePurityFixtures.RemoteHelper

  def build(context), do: RemoteHelper.value(context)
end

defmodule GroupherServer.Test.PipelinePurityFixtures.MacroWriteBuilder do
  @moduledoc false

  defmacro write_audit(value) do
    quote do
      GroupherServer.Repo.insert(unquote(value))
    end
  end

  def build(context), do: write_audit(context)
end

defmodule GroupherServer.Test.PipelinePurityFixtures.DynamicBuilder do
  @moduledoc false

  def build(context), do: apply(Map, :get, [context, :error])
end

defmodule GroupherServer.Test.PipelineGraphFixtures.GateInChange do
  @moduledoc false

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  @pipeline operation: :gate_in_change_fixture, access: :internal, target: :resource
  direct_pipeline execute(resource) do
    change(fn candidate, _operation_ref ->
      GroupherServer.CMS.Gate.check_in_transaction(:operations, :edit, candidate)
    end)
  end
end

defmodule GroupherServer.Test.PipelineGraphFixtures.GateInPresent do
  @moduledoc false

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  @pipeline operation: :gate_in_present_fixture, access: :internal, target: :resource
  direct_pipeline execute(resource) do
    change(fn candidate, _operation_ref -> {:ok, candidate} end)

    present(fn candidate ->
      GroupherServer.CMS.Gate.access_check(:operations, :edit, candidate)
    end)
  end
end

defmodule GroupherServer.CMS.Test.PipelineDefaultAdapterFixture do
  @moduledoc false

  use GroupherServer.CommandPipeline

  @pipeline operation: :cms_default_adapter_fixture, access: :internal, target: :resource
  direct_pipeline execute_internal(resource) do
    change(fn value, _operation_ref -> {:ok, value} end)
  end
end

defmodule GroupherServer.Test.PipelineGraphFixtures.UnattributedStages do
  @moduledoc false

  alias GroupherServer.CommandPipeline
  alias CommandPipeline.Runner

  @contract %{
    access: :internal,
    actor: nil,
    arity: 1,
    command_id: nil,
    confirmation: nil,
    module: __MODULE__,
    name: :execute,
    operation: :unattributed_stages_fixture,
    operation_ref: nil,
    params: nil,
    pipeline: :direct_pipeline,
    rejection_builder: nil,
    stages: [:change],
    steps: [],
    target: :resource
  }

  def __pipeline_contracts__, do: [@contract]

  def execute(resource) do
    arguments = %{resource: resource}
    input = Runner.build_input(arguments, @contract)
    Runner.run_direct(__MODULE__, @contract, input, stages(resource))
  end

  defp stages(resource), do: [change: fn _input, _operation_ref -> {:ok, resource} end]
end
