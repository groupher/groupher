defmodule GroupherServer.CMS.PipelineGraphTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CommandPipeline
  alias Mix.Tasks.Cms.Command.Pipeline, as: Graph
  alias CommandPipeline.GraphAnalyzer

  test "traces a facade to migrated pipelines and rejects internal reachability" do
    files =
      [
        "lib/groupher_server/cms/articles.ex",
        "lib/groupher_server/cms/articles/commands/publish.ex",
        "lib/groupher_server/cms/articles/commands/trash.ex",
        "lib/groupher_server_web/resolvers/cms/articles.ex"
      ]
      |> Enum.map(&Path.expand/1)

    contracts =
      [
        GroupherServer.CMS.Articles.Commands.Publish,
        GroupherServer.CMS.Articles.Commands.Trash
      ]
      |> Map.new(fn module -> {module, module.__pipeline_contracts__()} end)

    report = Graph.build_report(files, contracts)

    assert report["summary"]["pipelines_reached"] == 4
    assert report["summary"]["legacy_commands_reached"] == 0

    assert report["internal_pipeline_violations"] == []

    internal_contracts =
      Map.update!(
        contracts,
        GroupherServer.CMS.Articles.Commands.Trash,
        fn contracts ->
          Enum.map(contracts, fn contract ->
            if contract.name == :execute_receipt do
              Map.put(contract, :access, :internal)
            else
              contract
            end
          end)
        end
      )

    internal_report = Graph.build_report(files, internal_contracts)

    assert internal_report["summary"]["internal_pipeline_violations"] == 1

    assert [%{"module" => "GroupherServer.CMS.Articles.Commands.Trash"}] =
             internal_report["internal_pipeline_violations"]
  end

  test "keeps article maintenance trash on an explicit internal pipeline" do
    contracts = GroupherServer.CMS.Articles.Commands.Trash.__pipeline_contracts__()

    assert %{
             access: :internal,
             name: :run_internal,
             operation: :article_trash_internal,
             pipeline: :direct_pipeline
           } = Enum.find(contracts, &(&1.name == :run_internal))
  end

  test "traces default-argument internal entries through their generated super trampoline" do
    modules = [
      GroupherServer.CMS.DocTree.Commands.DeleteNode,
      GroupherServer.CMS.DocTree.Commands.DuplicateNode,
      GroupherServer.CMS.DocTree.Commands.MoveNode,
      GroupherServer.CMS.DocTree.Commands.UpdateNode
    ]

    files =
      [GroupherServer.CMS.DocTree | modules]
      |> Enum.map(fn module ->
        module.module_info(:compile)
        |> Keyword.fetch!(:source)
        |> to_string()
      end)

    contracts =
      Map.new(modules, fn module -> {module, module.__pipeline_contracts__()} end)

    reached =
      files
      |> Graph.build_report(contracts)
      |> Map.fetch!("pipelines_reached")
      |> MapSet.new(&{&1["module"], &1["function"], &1["arity"]})

    Enum.each(modules, fn module ->
      assert MapSet.member?(reached, {inspect(module), "run_tree_internal", 4})
    end)
  end

  test "builds the same report regardless of source file order" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def publish(value), do: GraphFixture.Deterministic.execute(value)
          end
          """,
          "commands/deterministic.ex" => """
          defmodule GraphFixture.Deterministic do
            direct_pipeline execute(value) do
              change(fn -> value end)
            end
          end
          """
        },
        %{GraphFixture.Deterministic => [contract(:direct_pipeline, :execute, [:change])]}
      )

    assert Graph.build_report(files, contracts) ==
             Graph.build_report(Enum.reverse(files), contracts)
  end

  test "fails closed when a super target cannot be resolved" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def publish(value), do: GraphFixture.UnknownSuper.execute(value)
          end
          """,
          "commands/unknown_super.ex" => """
          defmodule GraphFixture.UnknownSuper do
            def execute(value), do: super(value)
          end
          """
        },
        %{}
      )

    report = Graph.build_report(files, contracts)

    assert [%{"reason" => "unresolved super target"}] = report["unresolved_edges"]
  end

  test "reports a top-level pipeline reached through an ordinary helper" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def publish(value), do: GraphFixture.First.execute(value)
          end
          """,
          "commands/first.ex" => """
          defmodule GraphFixture.First do
            receipt_pipeline execute(value) do
              change(fn -> forward(value) end)
            end

            defp forward(value), do: GraphFixture.Second.execute(value)
          end
          """,
          "commands/second.ex" => """
          defmodule GraphFixture.Second do
            direct_pipeline execute(value) do
              change(fn -> value end)
            end
          end
          """
        },
        %{
          GraphFixture.First => [contract(:receipt_pipeline, :execute, [:change])],
          GraphFixture.Second => [contract(:direct_pipeline, :execute, [:change])]
        }
      )

    report = Graph.build_report(files, contracts)

    assert report["summary"]["top_level_pipeline_calls"] == 1

    assert [%{"from" => %{"module" => "GraphFixture.First"}, "to" => to}] =
             report["top_level_pipeline_calls"]

    assert to["module"] == "GraphFixture.Second"
  end

  test "reports a command write that bypasses every top-level pipeline" do
    {files, contracts} =
      fixture_graph(%{
        "facade.ex" => """
        defmodule GroupherServer.CMS.Articles do
          def update(value), do: GraphFixture.DirectWrite.execute(value)
        end
        """,
        "commands/direct_write.ex" => """
        defmodule GraphFixture.DirectWrite do
          def execute(value), do: persist(value)
          defp persist(value), do: GroupherServer.Repo.insert(value)
        end
        """
      })

    report = Graph.build_report(files, contracts)

    assert report["summary"]["unpipelined_command_writes"] == 2

    assert Enum.all?(report["unpipelined_command_writes"], fn violation ->
             violation["from"]["module"] == "GraphFixture.DirectWrite" and
               violation["to"] == %{
                 "arity" => 1,
                 "function" => "insert",
                 "module" => "GroupherServer.Repo"
               }
           end)
  end

  test "reports a reachable call to an undefined local helper" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def publish(value), do: GraphFixture.MissingLocal.execute(value)
          end
          """,
          "commands/missing_local.ex" => """
          defmodule GraphFixture.MissingLocal do
            def execute(value), do: undefined_local_helper(value)
          end
          """
        },
        %{}
      )

    report = Graph.build_report(files, contracts)

    assert [%{"reason" => "local target undefined_local_helper/1 is not defined"}] =
             report["unresolved_edges"]
  end

  test "fails closed on apply/3 outside an exact reviewed infrastructure MFA" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def publish(value), do: GraphFixture.DynamicCall.execute(value)
          end
          """,
          "commands/dynamic_call.ex" => """
          defmodule GraphFixture.DynamicCall do
            def execute(value), do: apply(__MODULE__, :save, [value])
            defp save(value), do: value
          end
          """
        },
        %{}
      )

    report = Graph.build_report(files, contracts)

    assert [%{"reason" => "apply/3"}] = report["unresolved_edges"]
  end

  test "treats a pipeline contract module as a Command without requiring execute" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def review(value), do: GraphFixture.NamedActions.start(value)
          end
          """,
          "commands/named_actions.ex" => """
          defmodule GraphFixture.NamedActions do
            def start(value), do: start_pipeline(value)

            receipt_pipeline start_pipeline(value) do
              change(fn -> value end)
            end
          end
          """
        },
        %{GraphFixture.NamedActions => [contract(:receipt_pipeline, :start_pipeline, [:change])]}
      )

    report = Graph.build_report(files, contracts)

    assert report["summary"]["pipelines_reached"] == 1
    assert report["summary"]["unreached_user_pipelines"] == 0
  end

  test "reports every user pipeline missing from the public entry graph" do
    {files, contracts} =
      fixture_graph(
        %{
          "commands/orphan.ex" => """
          defmodule GraphFixture.Orphan do
            receipt_pipeline run(value) do
              change(fn -> value end)
            end
          end
          """
        },
        %{GraphFixture.Orphan => [contract(:receipt_pipeline, :run, [:change])]}
      )

    report = Graph.build_report(files, contracts)

    assert report["summary"]["unreached_user_pipelines"] == 1
    assert [%{"module" => "GraphFixture.Orphan"}] = report["unreached_user_pipelines"]
  end

  test "fails closed when a reachable module uses a macro without compiled expansion" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            use GraphFixture.UnknownMacro
            def publish(value), do: GraphFixture.Command.execute(value)
          end
          """,
          "commands/command.ex" => """
          defmodule GraphFixture.Command do
            def execute(value), do: value
          end
          """
        },
        %{}
      )

    report = Graph.build_report(files, contracts)

    assert [%{"reason" => reason}] = report["parse_errors"]
    assert reason =~ "cannot prove expansion of use"
  end

  test "uses the compiled graph to reject Gate calls outside the gate stage" do
    fixture = GroupherServer.Test.PipelineGraphFixtures.GateInChange
    graph = GraphAnalyzer.build_modules([fixture, GroupherServer.CMS.Gate])
    scopes = GraphAnalyzer.pipeline_stage_calls(graph, fixture.__pipeline_contracts__())

    assert [violation] = Graph.gate_stage_violations(graph, scopes)
    assert violation["stage"] == "change"
    assert violation["gate"]["function"] == "check_in_transaction"
  end

  test "rejects compatibility Gate admission from the present stage" do
    fixture = GroupherServer.Test.PipelineGraphFixtures.GateInPresent
    graph = GraphAnalyzer.build_modules([fixture, GroupherServer.CMS.Gate])
    scopes = GraphAnalyzer.pipeline_stage_calls(graph, fixture.__pipeline_contracts__())

    assert [violation] = Graph.gate_stage_violations(graph, scopes)
    assert violation["stage"] == "present"
    assert violation["gate"]["function"] == "access_check"
  end

  test "fails closed when compiled pipeline stages cannot be attributed" do
    fixture = GroupherServer.Test.PipelineGraphFixtures.UnattributedStages
    contract = fixture.__pipeline_contracts__() |> List.first() |> Map.put(:access, :user)

    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def update(resource), do: GroupherServer.Test.PipelineGraphFixtures.UnattributedStages.execute(resource)
          end
          """,
          "commands/unattributed_stages.ex" => """
          defmodule GroupherServer.Test.PipelineGraphFixtures.UnattributedStages do
            def execute(resource) do
              input = GroupherServer.CommandPipeline.Runner.build_input(%{resource: resource}, %{})
              GroupherServer.CommandPipeline.Runner.run_direct(__MODULE__, %{}, input, stages(resource))
            end

            defp stages(resource), do: [change: fn _input -> {:ok, resource} end]
          end
          """
        },
        %{fixture => [contract]}
      )

    report = Graph.build_report(files, contracts)

    assert report["analysis_status"] == "incomplete"

    assert [error] = report["stage_analysis_errors"]
    assert error["expected"] == ["change"]
    assert error["found"] == []

    assert_raise Mix.Error, ~r/CMS pipeline graph is not proven/, fn ->
      Graph.validate_report!(report)
    end
  end

  test "uses the compiled graph to reject one Command entry reaching both protocols" do
    {files, contracts} =
      fixture_graph(
        %{
          "facade.ex" => """
          defmodule GroupherServer.CMS.Articles do
            def update(value, command_id), do: GraphFixture.MixedProtocol.execute(value, command_id)
          end
          """,
          "commands/mixed_protocol.ex" => """
          defmodule GraphFixture.MixedProtocol do
            def execute(value, nil), do: run_direct(value)
            def execute(value, command_id), do: run_receipt(value, command_id)

            direct_pipeline run_direct(value) do
              change(fn -> value end)
            end

            receipt_pipeline run_receipt(value, command_id) do
              change(fn -> {value, command_id} end)
            end
          end
          """
        },
        %{
          GraphFixture.MixedProtocol => [
            contract(:direct_pipeline, :run_direct, [:change]),
            %{contract(:receipt_pipeline, :run_receipt, [:change]) | arity: 2}
          ]
        }
      )

    report = Graph.build_report(files, contracts)

    assert report["summary"]["mixed_protocol_entries"] == 1
    assert [%{"entry" => %{"function" => "execute"}}] = report["mixed_protocol_entries"]
  end

  defp fixture_graph(sources, contracts \\ %{}) do
    root =
      Path.join(
        System.tmp_dir!(),
        "cms-command-graph-#{System.unique_integer([:positive, :monotonic])}"
      )

    files =
      Enum.map(sources, fn {relative, source} ->
        path = Path.join(root, relative)
        File.mkdir_p!(Path.dirname(path))
        File.write!(path, source)
        path
      end)

    on_exit(fn -> File.rm_rf!(root) end)
    {files, contracts}
  end

  defp contract(pipeline_type, name, stages) do
    %{
      access: :user,
      arity: 1,
      pipeline: pipeline_type,
      name: name,
      operation: nil,
      stages: stages
    }
  end
end
