defmodule GroupherServer.CMS.ContentImport.CheckpointsTest do
  use GroupherServer.DataCase, async: true

  import GroupherServer.Support.Factory

  alias GroupherServer.CMS.ContentImport.{Checkpoints, Entry, Plan, Snapshot}
  alias GroupherServer.CMS.ContentImport.Persistence
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Plan.Item
  alias GroupherServer.CMS.ContentImport.TestPayloadStore
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, PlanPayload, Preparation}

  test "recovers Snapshot, Preparation, and Plan from opaque payload refs" do
    {:ok, community} = db_insert(:community)

    {:ok, connection} =
      Persistence.create_connection(%{
        community_id: community.id,
        platform: :github,
        source_ref: "groupher/groupher",
        connection_key: "main",
        status: :active
      })

    snapshot = snapshot()

    assert {:ok, persisted_snapshot} =
             Checkpoints.persist_snapshot(connection.id, snapshot, TestPayloadStore)

    assert {:ok, restored_snapshot} =
             Checkpoints.load_snapshot(persisted_snapshot, TestPayloadStore)

    assert restored_snapshot.manifest_hash == snapshot.manifest_hash

    preparation =
      Preparation.new!(snapshot, :nextra, %{
        "source" => %{"framework" => "nextra"},
        "navigation" => []
      })

    attrs = %{
      community_id: community.id,
      connection_id: connection.id,
      snapshot_id: persisted_snapshot.id,
      thread: :doc,
      scope_ref: "import",
      status: :planning
    }

    assert {:ok, %{job: planning_job, created?: true}} =
             Checkpoints.start_job(attrs, effective_options: %{"branch" => "import"})

    assert is_nil(planning_job.plan_ref)

    assert {:ok, prepared_job} =
             Checkpoints.persist_preparation(planning_job, preparation, TestPayloadStore)

    assert {:ok, restored_preparation} =
             Checkpoints.load_preparation(
               prepared_job,
               restored_snapshot,
               TestPayloadStore
             )

    assert restored_preparation == preparation

    plan = plan()

    assert {:ok, %{job: job, items: [_], assets: []}} =
             Checkpoints.persist_plan(prepared_job, snapshot, plan, TestPayloadStore)

    assert is_binary(job.plan_ref)
    assert byte_size(job.plan_hash) == 64
    assert job.plan_summary["itemCount"] == 1
    assert job.status == :ready
    refute :plan in Job.__schema__(:fields)

    assert {:ok, restored_plan} = Checkpoints.load_plan(job, TestPayloadStore)
    assert restored_plan == plan
  end

  test "rejects a payload that no longer matches its persisted Plan hash" do
    {:ok, community} = db_insert(:community)

    {:ok, connection} =
      Persistence.create_connection(%{
        community_id: community.id,
        platform: :archive,
        source_ref: "zip:one",
        connection_key: "default",
        status: :active
      })

    snapshot = snapshot()

    {:ok, persisted_snapshot} =
      Checkpoints.persist_snapshot(connection.id, snapshot, TestPayloadStore)

    attrs = %{
      community_id: community.id,
      connection_id: connection.id,
      snapshot_id: persisted_snapshot.id,
      thread: :doc,
      scope_ref: "import",
      status: :planning
    }

    {:ok, %{job: planning_job}} = Checkpoints.start_job(attrs)

    preparation =
      Preparation.new!(snapshot, :nextra, %{
        "source" => %{"framework" => "nextra"},
        "navigation" => []
      })

    {:ok, prepared_job} =
      Checkpoints.persist_preparation(planning_job, preparation, TestPayloadStore)

    {:ok, %{job: job}} =
      Checkpoints.persist_plan(prepared_job, snapshot, plan(), TestPayloadStore)

    :ok = TestPayloadStore.corrupt(job.plan_ref, "{}")

    assert {:error, %{code: "unsupported_plan_payload"}} =
             Checkpoints.load_plan(job, TestPayloadStore)
  end

  defp snapshot do
    Snapshot.new!(%{
      platform: :github_repository,
      source_ref: "groupher/groupher",
      entries: [
        Entry.new!(%{
          external_ref: "docs/start.md",
          kind: :file,
          path: "docs/start.md",
          body: "# Start",
          body_format: :md
        })
      ],
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end

  defp plan do
    Plan.new!(%{
      thread: :doc,
      items: [
        Item.new!(%{
          external_ref: "docs/start.md",
          target_ref: "article:1",
          action: :create,
          source_hash: String.duplicate("a", 64),
          payload:
            ItemPayload.new!(%{
              article_hash_id: "article:1",
              title: "Start",
              content: %{"status" => "normalized"}
            })
        })
      ],
      assets: [],
      payload:
        PlanPayload.new!(%{
          schema_version: 1,
          source: %{"framework" => "nextra"},
          target: %{"thread" => "doc"},
          tree: %{"tabs" => []}
        })
    })
  end
end
