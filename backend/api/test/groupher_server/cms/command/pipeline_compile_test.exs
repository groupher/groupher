defmodule GroupherServer.CommandPipelineCompileTest do
  use ExUnit.Case, async: true

  defmodule Fixture do
    use GroupherServer.CommandPipeline

    @pipeline operation: :pipeline_fixture_write, target: :resource
    direct_pipeline execute(resource, actor, opts) do
      gate(fn value -> {:ok, value} end)
      change(fn value, _operation_ref -> {:ok, {value, actor, opts}} end)
    end

    @pipeline operation: :pipeline_fixture_write_second, target: :resource
    direct_pipeline execute_second(resource, actor, opts) do
      gate(fn value -> {:ok, value} end)
      change(fn value, _operation_ref -> {:ok, {value, actor, opts}} end)
    end
  end

  test "compiler emits one machine-readable contract per declaration" do
    contracts = Fixture.__pipeline_contracts__()

    assert [
             %{
               pipeline: :direct_pipeline,
               operation: :pipeline_fixture_write,
               arguments: [:resource, :actor, :opts],
               target: :resource,
               stages: [:gate, :change]
             },
             %{
               pipeline: :direct_pipeline,
               operation: :pipeline_fixture_write_second,
               stages: [:gate, :change]
             }
           ] = contracts
  end

  test "change callbacks require the resource and operation UUID" do
    assert_raise ArgumentError, ~r/change callback must have arity 2/, fn ->
      compile_fixture("""
      defmodule PipelineSingleArgumentChangeFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_single_argument_change, access: :internal, target: :resource
        direct_pipeline execute(resource) do
          change(fn value -> {:ok, value} end)
        end
      end
      """)
    end
  end

  test "rejects guards, defaults, and invalid target declarations" do
    assert_raise ArgumentError, ~r/does not support guards/, fn ->
      compile_fixture("""
      defmodule PipelineGuardFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_guard_fixture
        direct_pipeline execute(resource) when is_map(resource) do
          gate fn value -> {:ok, value} end
          change fn value, _operation_ref -> {:ok, value} end
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/simple arguments/, fn ->
      compile_fixture("""
      defmodule PipelineDefaultFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_default_fixture
        direct_pipeline execute(resource \\\\ nil) do
          gate fn value -> {:ok, value} end
          change fn value, _operation_ref -> {:ok, value} end
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/target :missing is not a function argument/, fn ->
      compile_fixture("""
      defmodule PipelineTargetFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_target_fixture, target: :missing
        direct_pipeline execute(resource) do
          gate fn value -> {:ok, value} end
          change fn value, _operation_ref -> {:ok, value} end
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/requires @pipeline target/, fn ->
      compile_fixture("""
      defmodule PipelineMissingTargetFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_missing_target_fixture
        direct_pipeline execute(resource) do
          gate fn value -> {:ok, value} end
          change fn value, _operation_ref -> {:ok, value} end
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/receipt_pipeline requires params/, fn ->
      compile_fixture("""
      defmodule PipelineMissingParamsFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_missing_params_fixture,
                  confirmation: GroupherServer.CommandPipelineCompileTest.Fixture,
                  target: :resource
        receipt_pipeline execute(resource, actor, command_id) do
          gate fn value -> {:ok, {value, actor}} end
          change fn value, _operation_ref -> {:ok, value} end
          confirm fn value -> {:ok, {value, command_id}} end
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/cms_open_access_forbidden/, fn ->
      compile_fixture("""
      defmodule GroupherServer.CMS.PipelineOpenAccessFixture do
        use GroupherServer.CommandPipeline,
          adapter: GroupherServer.CMS.CommandPipelineAdapter

        @pipeline operation: :pipeline_open_access_fixture, access: :open, target: :resource
        direct_pipeline execute(resource) do
          change(fn value, _operation_ref -> {:ok, value} end)
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/default_adapter_does_not_support_on_rejection/, fn ->
      compile_fixture("""
      defmodule PipelineDefaultAdapterRejectionFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_default_adapter_rejection_fixture,
                  access: :open,
                  target: :resource
        direct_pipeline execute(resource, actor) do
          change(fn value, _operation_ref -> {:ok, value} end)
          on_rejection(&build_rejection/1)
        end

        defp build_rejection(_context), do: %{}
      end
      """)
    end

    assert_raise ArgumentError, ~r/default_adapter_does_not_support_receipt_pipeline/, fn ->
      compile_fixture("""
      defmodule PipelineDefaultAdapterReceiptFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_default_adapter_receipt_fixture,
                  access: :open,
                  target: :resource,
                  params: [],
                  confirmation: GroupherServer.CMS.Articles.Commands.PublishArticleConfirmation
        receipt_pipeline execute(resource, command_id) do
          change(fn value, _operation_ref -> {:ok, value} end)
          confirm(fn value -> {:ok, value} end)
        end
      end
      """)
    end

    assert_raise ArgumentError, ~r/open pipeline with on_rejection requires actor/, fn ->
      compile_fixture("""
      defmodule PipelineOpenRejectionActorFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_open_rejection_actor_fixture,
                  access: :open,
                  target: :resource
        direct_pipeline execute(resource) do
          change(fn value, _operation_ref -> {:ok, value} end)
          on_rejection(&build_rejection/1)
        end

        defp build_rejection(_context), do: %{}
      end
      """)
    end

    assert_raise ArgumentError, ~r/open pipeline cannot declare gate/, fn ->
      compile_fixture("""
      defmodule PipelineOpenGateFixture do
        use GroupherServer.CommandPipeline

        @pipeline operation: :pipeline_open_gate_fixture, access: :open, target: :resource
        direct_pipeline execute(resource) do
          gate(fn value -> {:ok, value} end)
          change(fn value, _operation_ref -> {:ok, value} end)
        end
      end
      """)
    end
  end

  defp compile_fixture(source) do
    Code.compile_string(
      source,
      "pipeline_compile_fixture_#{System.unique_integer([:positive])}.ex"
    )
  end
end
