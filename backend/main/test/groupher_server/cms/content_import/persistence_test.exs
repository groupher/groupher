defmodule GroupherServer.CMS.ContentImport.PersistenceTest do
  use GroupherServer.DataCase, async: true

  import GroupherServer.Support.Factory

  alias GroupherServer.CMS.ContentImport.{Entry, Persistence, Plan, Snapshot}
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Asset, as: PersistedAsset
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item, as: PersistedItem
  alias GroupherServer.CMS.ContentImport.Persistence.Mapping, as: PersistedMapping
  alias GroupherServer.CMS.ContentImport.Plan.Codec
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, PlanPayload}

  test "serializes typed Plan structs into bounded JSON-compatible data" do
    item =
      Item.new!(%{
        external_ref: "docs/start.md",
        target_ref: "article:1",
        action: :create,
        source_hash: String.duplicate("a", 64),
        payload: item_payload("article:1")
      })

    asset =
      Asset.new!(%{
        asset_key: "asset_logo",
        source: {:remote_url, "https://cdn.example.com/logo.png"},
        references: [%{"externalRef" => "docs/start.md"}]
      })

    plan = Plan.new!(%{thread: :doc, items: [item], assets: [asset], payload: plan_payload()})
    serialized = Codec.encode(plan)

    assert serialized["type"] == "content_import_plan"
    assert serialized["thread"] == "doc"
    assert get_in(serialized, ["assets", Access.at(0), "source", "type"]) == "remote_url"
    assert hd(serialized["assets"])["stagingRef"] == nil
    assert Jason.encode!(serialized)
  end

  test "deduplicates Snapshot and Job persistence and materializes assets once" do
    {:ok, community} = db_insert(:community)

    assert {:ok, connection} =
             Persistence.create_connection(%{
               community_id: community.id,
               platform: :github,
               source_ref: "groupher/groupher",
               connection_key: "main",
               status: :active
             })

    entry = Entry.new!(%{external_ref: "docs/start.md", kind: :file, body: "# Start"})

    snapshot =
      Snapshot.new!(%{
        platform: :github,
        source_ref: "groupher/groupher",
        entries: [entry],
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    assert {:ok, first_snapshot} =
             Persistence.persist_snapshot(connection.id, snapshot, "object://snapshot/1")

    assert {:ok, same_snapshot} =
             Persistence.persist_snapshot(connection.id, snapshot, "object://snapshot/ignored")

    assert same_snapshot.id == first_snapshot.id

    plan = plan_with_asset(entry)

    attrs = %{
      community_id: community.id,
      connection_id: connection.id,
      snapshot_id: first_snapshot.id,
      thread: :doc,
      status: :planning
    }

    assert {:ok, %{job: planning_job, created?: true}} = Persistence.start_job(attrs)

    assert is_nil(planning_job.plan_ref)

    assert {:ok, %{job: same_planning_job, created?: false}} = Persistence.start_job(attrs)
    assert same_planning_job.id == planning_job.id

    assert {:ok, %{job: forced_job, created?: true}} =
             Persistence.start_job(attrs, run_nonce: "manual-2")

    assert forced_job.id != planning_job.id

    assert {:error, :doc_preparation_required} =
             Persistence.attach_plan(planning_job, snapshot, plan, "object://plan/rejected")

    assert {:ok, prepared_job} =
             Persistence.attach_preparation(
               planning_job,
               snapshot.manifest_hash,
               preparation_locator("object://preparation/1")
             )

    assert {:ok, same_prepared_job} =
             Persistence.attach_preparation(
               prepared_job,
               snapshot.manifest_hash,
               preparation_locator("object://preparation/ignored")
             )

    assert same_prepared_job.id == prepared_job.id

    different_locator = %{
      preparation_locator("object://preparation/2")
      | preparation_hash: String.duplicate("e", 64)
    }

    assert {:error, :preparation_checkpoint_mismatch} =
             Persistence.attach_preparation(
               prepared_job,
               snapshot.manifest_hash,
               different_locator
             )

    mismatched_snapshot = %{snapshot | manifest_hash: String.duplicate("d", 64)}

    assert {:error, :job_snapshot_mismatch} =
             Persistence.attach_plan(
               prepared_job,
               mismatched_snapshot,
               plan,
               "object://plan/rejected"
             )

    assert {:ok, %{job: job, created?: true, items: [_], assets: [_]}} =
             Persistence.attach_plan(prepared_job, snapshot, plan, "object://plan/1")

    assert {:ok, %{job: same_job, created?: false, items: [_], assets: [_]}} =
             Persistence.attach_plan(job, snapshot, plan, "object://plan/ignored")

    different_plan = %{
      plan
      | payload: PlanPayload.new!(%{plan_payload() | source: %{"revision" => 2}})
    }

    assert {:error, :plan_checkpoint_mismatch} =
             Persistence.attach_plan(job, snapshot, different_plan, "object://plan/2")

    assert same_job.id == planning_job.id
    assert job.plan_ref == "object://plan/1"
    assert job.plan_summary["itemCount"] == 1
    refute :plan in Job.__schema__(:fields)
    assert Repo.aggregate(PersistedAsset, :count) == 1
    assert Repo.aggregate(PersistedItem, :count) == 1
    assert Repo.aggregate(Job, :count) == 2
  end

  test "upserts Mapping checkpoints without changing source identity" do
    {:ok, community} = db_insert(:community)

    {:ok, connection} =
      Persistence.create_connection(%{
        community_id: community.id,
        platform: :archive,
        source_ref: "zip:one",
        connection_key: "default",
        status: :active
      })

    attrs = %{
      connection_id: connection.id,
      external_ref: "docs/start.md",
      thread: :doc,
      target_ref: "article:1",
      last_imported_source_hash: String.duplicate("a", 64),
      last_imported_local_hash: String.duplicate("b", 64),
      last_imported_at: ~U[2026-07-14 00:00:00Z]
    }

    assert {:ok, first} = Persistence.upsert_mapping(attrs)

    assert {:ok, updated} =
             Persistence.upsert_mapping(%{
               attrs
               | last_imported_source_hash: String.duplicate("c", 64),
                 last_imported_at: ~U[2026-07-14 01:00:00Z]
             })

    assert updated.id == first.id
    assert Repo.aggregate(PersistedMapping, :count) == 1
    assert updated.last_imported_source_hash == String.duplicate("c", 64)
  end

  defp plan_with_asset(entry) do
    item =
      Item.new!(%{
        external_ref: entry.external_ref,
        target_ref: "article:1",
        action: :create,
        source_hash: entry.content_hash,
        payload: item_payload("article:1")
      })

    asset =
      Asset.new!(%{
        asset_key: "asset_logo",
        source: {:remote_url, "https://cdn.example.com/logo.png"},
        references: [%{"externalRef" => entry.external_ref}]
      })

    Plan.new!(%{thread: :doc, items: [item], assets: [asset], payload: plan_payload()})
  end

  defp item_payload(article_hash_id) do
    ItemPayload.new!(%{
      article_hash_id: article_hash_id,
      content: %{"status" => "normalized"}
    })
  end

  defp plan_payload do
    PlanPayload.new!(%{
      schema_version: 1,
      source: %{"framework" => "test"},
      target: %{"thread" => "doc"},
      tree: %{"tabs" => []}
    })
  end

  defp preparation_locator(ref) do
    %{
      preparation_ref: ref,
      preparation_hash: String.duplicate("f", 64),
      preparation_version: 1
    }
  end
end
