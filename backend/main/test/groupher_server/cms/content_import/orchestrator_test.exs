defmodule GroupherServer.CMS.ContentImport.OrchestratorTest do
  use GroupherServer.DataCase, async: false

  import GroupherServer.Support.Factory

  alias GroupherServer.CMS.ContentImport.{
    ApplyResult,
    Entry,
    Orchestrator,
    Persistence,
    Plan,
    Snapshot
  }

  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Asset, as: PersistedAsset
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item, as: PersistedItem
  alias GroupherServer.CMS.ContentImport.Persistence.Mapping, as: PersistedMapping
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Threads.Changelog.{ItemPayload, PlanPayload}

  defmodule TransactionProbeAdapter do
    @behaviour GroupherServer.CMS.ContentImport.ThreadAdapter

    alias GroupherServer.CMS.ContentImport.ApplyResult
    alias GroupherServer.CMS.ContentImport.Persistence.Job.Item, as: PersistedItem
    alias GroupherServer.Repo

    @impl true
    def validate(_snapshot, _context, _opts), do: :ok

    @impl true
    def plan(_snapshot, _context, _plan_context), do: {:error, []}

    @impl true
    def project_preview(_plan), do: {:error, []}

    @impl true
    def apply_in_transaction(plan, _actor, opts) do
      opts
      |> Keyword.fetch!(:job_id)
      |> then(fn job_id ->
        %PersistedItem{}
        |> PersistedItem.changeset(%{
          job_id: job_id,
          external_ref: "probe:thread-write",
          target_ref: "probe:thread-write",
          action: :skip,
          selected: true
        })
        |> Repo.insert!()
      end)

      ApplyResult.new(%{
        items:
          Enum.map(plan.items, fn item ->
            %{
              external_ref: item.external_ref,
              target_ref: item.target_ref,
              status: if(item.action == :create, do: :created, else: :updated)
            }
          end),
        assets: []
      })
    end
  end

  test "claims bounded asset batches and advances the Job only after every asset is terminal" do
    %{job: job} = persisted_job(3, :planning)
    now = ~U[2026-07-14 02:00:00Z]

    assert {:ok, %{job: %{status: :staging}, assets: first_batch}} =
             Orchestrator.claim_assets(job, limit: 2, lease_seconds: 30, now: now)

    assert length(first_batch) == 2
    assert Enum.all?(first_batch, &(&1.status == :staging and &1.attempts == 1))

    assert {:ok, %{assets: [third]}} =
             Orchestrator.claim_assets(job, limit: 2, lease_seconds: 30, now: now)

    assert {:ok, %{job: %{status: :staging}}} =
             Orchestrator.complete_asset(hd(first_batch), %{
               content_hash: String.duplicate("a", 64),
               staging_ref: "staging://asset-1"
             })

    assert {:ok, %{job: %{status: :staging}}} =
             Orchestrator.fail_asset(Enum.at(first_batch, 1), %{"code" => "download_failed"})

    assert {:ok, %{job: %{status: :ready}, asset: %{status: :ready}}} =
             Orchestrator.complete_asset(third, %{
               content_hash: String.duplicate("b", 64),
               staging_ref: "staging://asset-3"
             })

    persisted_job = Repo.get!(Job, job.id)
    assert persisted_job.status == :ready
    assert get_in(persisted_job.progress, ["assets", "ready"]) == 2
    assert get_in(persisted_job.progress, ["assets", "failed"]) == 1
    assert persisted_job.progress["assetTerminalCount"] == 3

    assert {:ok, %{job: %{status: :staging}, assets: [retried]}} =
             Orchestrator.claim_assets(persisted_job,
               limit: 1,
               now: DateTime.add(now, 60, :second)
             )

    assert retried.attempts == 2

    assert {:ok, %{job: %{status: :ready}}} =
             Orchestrator.complete_asset(retried, %{
               content_hash: String.duplicate("c", 64),
               staging_ref: "staging://asset-2-retry"
             })

    assert get_in(Repo.get!(Job, job.id).progress, ["assets", "ready"]) == 3
  end

  test "reclaims an expired staging lease without duplicating the asset row" do
    %{job: job} = persisted_job(1, :planning)
    first_claim_at = ~U[2026-07-14 02:00:00Z]

    assert {:ok, %{assets: [first]}} =
             Orchestrator.claim_assets(job,
               limit: 1,
               lease_seconds: 10,
               now: first_claim_at
             )

    assert {:ok, %{assets: [reclaimed]}} =
             Orchestrator.claim_assets(job,
               limit: 1,
               lease_seconds: 10,
               now: DateTime.add(first_claim_at, 11, :second)
             )

    assert reclaimed.id == first.id
    assert reclaimed.attempts == 2
    assert Repo.aggregate(PersistedAsset, :count) == 1
  end

  test "cancels open assets with the Job and rejects retrying a cancelled Job" do
    %{job: job} = persisted_job(2, :planning)

    assert {:ok, cancelled} = Orchestrator.cancel_job(job, now: ~U[2026-07-14 03:00:00Z])
    assert cancelled.status == :cancelled
    assert cancelled.cancelled_at == ~U[2026-07-14 03:00:00Z]

    assert Repo.all(PersistedAsset) |> Enum.all?(&(&1.status == :cancelled))
    assert {:error, {:job_not_retryable, :cancelled}} = Orchestrator.retry_job(cancelled)
  end

  test "applies thread writes, Mapping checkpoints, and Job completion atomically" do
    %{job: job, snapshot: snapshot, plan: plan} = persisted_apply_job()
    assert {:ok, applying} = Orchestrator.begin_apply(job)
    initial_item_count = Repo.aggregate(PersistedItem, :count)

    assert {:error, {:local_hash_missing, "article:created"}} =
             Orchestrator.apply_job(
               applying,
               snapshot,
               plan,
               TransactionProbeAdapter,
               :actor,
               %{},
               job_id: job.id
             )

    assert Repo.aggregate(PersistedItem, :count) == initial_item_count
    assert Repo.aggregate(PersistedMapping, :count) == 0
    assert Repo.get!(Job, job.id).status == :applying

    local_hashes =
      Map.new(plan.items, fn item -> {item.target_ref, "local:#{item.target_ref}"} end)

    assert {:ok, %{job: completed, mappings: mappings, result: %ApplyResult{}}} =
             Orchestrator.apply_job(
               applying,
               snapshot,
               plan,
               TransactionProbeAdapter,
               :actor,
               local_hashes,
               job_id: job.id
             )

    assert completed.status == :completed
    assert length(mappings) == 2
    assert Repo.aggregate(PersistedItem, :count) == initial_item_count + 1
    assert Repo.aggregate(PersistedMapping, :count) == 2
  end

  test "persists and validates one resolution per Job item" do
    %{job: job} = persisted_job(0, :ready)
    item = Repo.get_by!(PersistedItem, job_id: job.id, external_ref: "release:1")
    item |> Ecto.Changeset.change(action: :conflict) |> Repo.update!()

    assert {:error, %Ecto.Changeset{}} =
             Orchestrator.resolve_item(job, item.external_ref, :archive)

    assert {:ok, resolved} =
             Orchestrator.resolve_item(job, item.external_ref, :source_wins)

    assert resolved.resolution == :source_wins
  end

  defp persisted_job(asset_count, status) do
    {:ok, community} = db_insert(:community)
    {:ok, connection} = connection(community.id)
    entry = entry("release:1", "Release body")
    snapshot = snapshot([entry])

    {:ok, persisted_snapshot} =
      Persistence.persist_snapshot(
        connection.id,
        snapshot,
        "object://snapshot/#{snapshot.manifest_hash}"
      )

    plan = plan([entry], asset_count)

    attrs = %{
      community_id: community.id,
      connection_id: connection.id,
      snapshot_id: persisted_snapshot.id,
      thread: :changelog,
      status: status
    }

    {:ok, %{job: planning_job}} = Persistence.start_job(attrs)

    {:ok, %{job: job, assets: assets}} =
      Persistence.attach_plan(
        planning_job,
        snapshot,
        plan,
        "object://plan/#{System.unique_integer([:positive])}"
      )

    %{
      community: community,
      connection: connection,
      snapshot: persisted_snapshot,
      plan: plan,
      job: job,
      assets: assets
    }
  end

  defp persisted_apply_job do
    {:ok, community} = db_insert(:community)
    {:ok, connection} = connection(community.id)
    entries = [entry("release:created", "Created body"), entry("release:skipped", "Skipped body")]
    domain_snapshot = snapshot(entries)

    {:ok, persisted_snapshot} =
      Persistence.persist_snapshot(
        connection.id,
        domain_snapshot,
        "object://snapshot/#{domain_snapshot.manifest_hash}"
      )

    plan = plan(entries, 0)

    attrs = %{
      community_id: community.id,
      connection_id: connection.id,
      snapshot_id: persisted_snapshot.id,
      thread: :changelog,
      status: :ready
    }

    {:ok, %{job: planning_job}} = Persistence.start_job(attrs)

    {:ok, %{job: job}} =
      Persistence.attach_plan(
        planning_job,
        domain_snapshot,
        plan,
        "object://plan/#{System.unique_integer([:positive])}"
      )

    %{job: job, snapshot: persisted_snapshot, plan: plan}
  end

  defp connection(community_id) do
    Persistence.create_connection(%{
      community_id: community_id,
      platform: :github,
      source_ref: "groupher/groupher:releases",
      connection_key: "default-#{System.unique_integer([:positive])}",
      status: :active
    })
  end

  defp snapshot(entries) do
    Snapshot.new!(%{
      platform: :github_releases,
      source_ref: "groupher/groupher:releases",
      entries: entries,
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end

  defp entry(external_ref, body) do
    Entry.new!(%{external_ref: external_ref, kind: :record, body: body, body_format: :md})
  end

  defp plan(entries, asset_count) do
    items =
      entries
      |> Enum.with_index()
      |> Enum.map(fn {entry, index} ->
        target_ref = if index == 0, do: "article:created", else: "article:skipped"

        Item.new!(%{
          external_ref: entry.external_ref,
          target_ref: target_ref,
          action: :create,
          source_hash: entry.content_hash,
          payload:
            ItemPayload.new!(%{
              title: entry.external_ref,
              content: %{"status" => "normalized"}
            })
        })
      end)

    assets =
      if asset_count > 0 do
        Enum.map(1..asset_count, fn index ->
          Asset.new!(%{
            asset_key: "asset_#{index}",
            source: {:remote_url, "https://cdn.example.com/#{index}.png"}
          })
        end)
      else
        []
      end

    Plan.new!(%{
      thread: :changelog,
      items: items,
      assets: assets,
      payload:
        PlanPayload.new!(%{
          schema_version: 1,
          source: %{"platform" => "test"},
          target: %{"thread" => "changelog"}
        })
    })
  end
end
