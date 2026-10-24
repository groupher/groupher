defmodule GroupherServer.CommandPipelineRunnerTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, CMS, CommandPipeline, ErrorCat}
  alias Activity.Model.PostLog
  alias CMS.Gate.Decision
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CommandPipeline.{Rejected, RejectionContext, RejectionData}
  alias ErrorCat.Error

  defmodule GenericFixture do
    use GroupherServer.CommandPipeline

    @pipeline operation: :generic_pipeline_runner_behavior,
              access: :internal,
              target: :resource
    direct_pipeline execute(resource) do
      change(fn resource ->
        send(self(), {:generic_pipeline_stage, :change, Repo.in_transaction?()})
        {:ok, resource}
      end)

      present(fn resource ->
        send(self(), {:generic_pipeline_stage, :present, Repo.in_transaction?()})
        {:ok, resource}
      end)
    end
  end

  defmodule Fixture do
    use GroupherServer.CommandPipeline,
      adapter: GroupherServer.CMS.CommandPipelineAdapter

    @pipeline operation: :pipeline_runner_behavior, access: :internal, target: :resource
    direct_pipeline execute(resource, actor, opts) do
      prepare(fn ->
        send(self(), {:pipeline_stage, :prepare, Repo.in_transaction?()})
        {:ok, {:prepared, resource}}
      end)

      gate(fn
        {:prepared, %{mode: :plain_error}} ->
          send(self(), {:pipeline_stage, :gate, Repo.in_transaction?()})
          {:error, :resource_not_found}

        {:prepared, %{mode: :callback_error}} ->
          {:error, Rejected.new(:callback_error, :callback_error)}

        {:prepared, %{mode: :callback_raise}} ->
          {:error, Rejected.new(:callback_raise, :callback_raise)}

        {:prepared, %{mode: :decision_error}} ->
          {:error, Decision.deny(GateErrorCat.article_archived())}

        {:prepared, ^resource} = value ->
          send(self(), {:pipeline_stage, :gate, Repo.in_transaction?()})
          {:ok, value}
      end)

      lifecycle(fn value ->
        send(self(), {:pipeline_stage, :lifecycle, Repo.in_transaction?()})
        {:ok, value}
      end)

      change(fn value ->
        send(self(), {:pipeline_stage, :change, Repo.in_transaction?()})
        {:ok, {value, actor, opts}}
      end)

      present(fn value ->
        send(self(), {:pipeline_stage, :present, Repo.in_transaction?()})
        {:ok, value}
      end)

      on_rejection(&build_rejection/1)
    end

    @pipeline operation: :pipeline_runner_domain_workflow_behavior,
              access: :internal,
              target: :resource
    direct_pipeline execute_domain_workflow(resource, actor, opts) do
      gate(fn value -> {:ok, value} end)

      change(fn value ->
        _ = value
        {:error, Rejected.new(:domain_workflow_rejected, :domain_workflow_rejected)}
      end)

      on_rejection(&build_rejection/1)
    end

    @pipeline operation: :pipeline_runner_write_audit, target: :resource
    direct_pipeline execute_audit(resource, actor, opts) do
      gate(fn _value -> {:error, Rejected.new(:write_rejected, :write_rejected)} end)
      change(fn value -> {:ok, {value, opts}} end)

      on_rejection(&build_audit_rejection/1)
    end

    @pipeline operation: :pipeline_runner_rejection_behavior,
              target: :resource,
              params: :opts
    direct_pipeline execute_rejection(resource, actor, opts) do
      gate(fn _value -> {:error, Rejected.new(:rejection_builder, :rejection_builder)} end)
      change(fn value -> {:ok, value} end)
      on_rejection(&build_rejection/1)
    end

    @pipeline operation: :pipeline_runner_invalid_rejection,
              access: :internal,
              target: :resource,
              params: :opts
    direct_pipeline execute_invalid_rejection(resource, actor, opts) do
      gate(fn _value -> {:error, Rejected.new(:invalid_payload, :invalid_payload)} end)
      change(fn value -> {:ok, value} end)
      on_rejection(&build_invalid_rejection/1)
    end

    @pipeline operation: :pipeline_runner_gate_stage,
              access: :internal,
              target: :resource
    direct_pipeline execute_gate_from_change(resource) do
      change(fn candidate ->
        GroupherServer.CMS.Gate.check_in_transaction(:operations, :edit, candidate)
      end)
    end

    defp build_rejection(%RejectionContext{error: :callback_raise}) do
      raise "rejection builder failed"
    end

    defp build_rejection(%RejectionContext{arguments: %{resource: resource}}) do
      %RejectionData{
        resource: resource,
        action: :trashed,
        rejection_code: :article_archived
      }
    end

    defp build_audit_rejection(%RejectionContext{arguments: %{resource: resource}}) do
      %RejectionData{resource: resource, action: :trashed, rejection_code: :article_archived}
    end

    defp build_invalid_rejection(_context), do: :invalid_payload
  end

  test "runs prepare before the direct transaction stages" do
    resource = %{id: "article-1"}

    assert {:ok, {{:prepared, ^resource}, nil, []}} = Fixture.execute(resource, nil, [])
  end

  test "the generic runner owns the direct transaction without a CMS adapter" do
    resource = %{id: "generic-runner"}

    assert {:ok, ^resource} = GenericFixture.execute(resource)
    assert_receive {:generic_pipeline_stage, :change, true}
    assert_receive {:generic_pipeline_stage, :present, false}
  end

  test "runner fixes stage order and transaction ownership" do
    resource = %{id: "article-order"}

    assert {:ok, _result} = Fixture.execute(resource, nil, [])

    assert_receive {:pipeline_stage, :prepare, false}
    assert_receive {:pipeline_stage, :gate, true}
    assert_receive {:pipeline_stage, :lifecycle, true}
    assert_receive {:pipeline_stage, :change, true}
    assert_receive {:pipeline_stage, :present, false}
  end

  test "Gate join-only APIs reject calls outside the gate stage" do
    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :gate},
              reason: :gate_stage_required
            }} =
             Fixture.execute_gate_from_change(%GroupherServer.CMS.Model.Community{id: 1})
  end

  test "runs rejection handling only for an explicit Rejected result" do
    plain_error = %{id: "article-2", mode: :plain_error}
    rejected = %{id: "article-3", mode: :callback_error}

    assert {:error, :resource_not_found} = Fixture.execute(plain_error, nil, [])

    assert {:error, :callback_error} = Fixture.execute(rejected, nil, [])
  end

  test "converts a Gate Decision into an explicit rejection" do
    resource = %{id: "article-5", mode: :decision_error}

    assert {:error, %Error{reason: :article_archived}} =
             Fixture.execute(resource, nil, [])
  end

  test "preserves an explicit rejection returned by a domain workflow" do
    assert {:error, :domain_workflow_rejected} =
             Fixture.execute_domain_workflow(%{id: "article-6"}, nil, [])
  end

  test "rejection builder exceptions do not replace the original error" do
    resource = %{id: "article-4", mode: :callback_raise}
    handler_id = "pipeline-runner-#{System.unique_integer([:positive])}"

    :telemetry.attach(
      handler_id,
      [:groupher, :command_pipeline, :rejection],
      fn _event, _measurements, metadata, owner ->
        send(owner, {:pipeline_rejection_telemetry, metadata})
      end,
      self()
    )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert {:error, :callback_raise} = Fixture.execute(resource, nil, [])
    assert_receive {:pipeline_rejection_telemetry, %{kind: :rejection_builder_exception}}
  end

  test "direct rejection operation refs are unique per attempt and actor" do
    {_community, post, _attrs, owner} = mock_article(:post)
    {:ok, stranger} = db_insert(:user)

    assert {:error, :write_rejected} = Fixture.execute_audit(post, owner, [])
    assert {:error, :write_rejected} = Fixture.execute_audit(post, owner, [])
    assert {:error, :write_rejected} = Fixture.execute_audit(post, stranger, [])

    events =
      Repo.all(
        from(log in PostLog, where: log.article_id == ^post.article_id and log.action == :trashed)
      )

    assert length(events) == 3
    assert events |> Enum.map(& &1.operation_ref) |> Enum.uniq() |> length() == 3
    assert Enum.count(events, &(&1.actor_ref == owner.login)) == 2
    assert Enum.count(events, &(&1.actor_ref == stranger.login)) == 1
  end

  test "on_rejection builds and writes audit data after the pipeline transaction" do
    {_community, post, _attrs, owner} = mock_article(:post)

    assert {:error, :rejection_builder} = Fixture.execute_rejection(post, owner, [])

    event =
      Repo.one!(
        from(log in PostLog,
          where: log.article_id == ^post.article_id and log.action == :trashed,
          order_by: [desc: log.record_sequence]
        )
      )

    assert event.rejection_code == "article_archived"
    assert event.actor_ref == owner.login
    assert event.source == :api
  end

  test "invalid rejection data is telemetry-only and preserves the original error" do
    handler_id = "pipeline-invalid-rejection-#{System.unique_integer([:positive])}"

    :telemetry.attach(
      handler_id,
      [:groupher, :command_pipeline, :rejection],
      fn _event, _measurements, metadata, owner ->
        send(owner, {:invalid_rejection, metadata})
      end,
      self()
    )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert {:error, :invalid_payload} = Fixture.execute_invalid_rejection(%{id: "bad"}, nil, [])
    assert_receive {:invalid_rejection, %{kind: :rejection_write_error}}
  end
end
