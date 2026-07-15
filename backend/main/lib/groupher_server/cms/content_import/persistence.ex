defmodule GroupherServer.CMS.ContentImport.Persistence do
  @moduledoc """
  Domain-to-row projections and idempotent ContentImport persistence operations.

      Connection
          |
          v
      Snapshot row <---- manifest-hash idempotency
          |
          v
      Job(planning) <--- connection + deterministic idempotency key
          |
          +--> preparation locator
          |
          `--> plan locator + summary
                    |
                    +--> Job.Item  -- insert_all / 500 rows per batch
                    `--> Job.Asset -- insert_all / 500 rows per batch

      successful apply
          |
          `--> Mapping -- upsert by connection + thread + external_ref

  Large Snapshot, Preparation, and Plan payloads are not stored here. This layer
  persists bounded locators, summaries, administrator decisions, and recoverable
  asset state. It does not execute thread writes or external asset publication.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.ContentImport.{IdempotencyKey, Plan, Snapshot, Status}
  alias GroupherServer.CMS.ContentImport.Plan.Codec, as: PlanCodec

  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Mapping, as: PersistedMapping
  alias GroupherServer.CMS.ContentImport.Persistence.Snapshot, as: PersistedSnapshot
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Asset, as: PersistedAsset
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item, as: PersistedItem
  alias GroupherServer.Repo

  @insert_batch_size 500

  @spec create_connection(map()) :: {:ok, Connection.t()} | {:error, Ecto.Changeset.t()}
  def create_connection(attrs) do
    %Connection{}
    |> Connection.changeset(attrs)
    |> Repo.insert()
  end

  @spec persist_snapshot(pos_integer(), Snapshot.t(), String.t()) ::
          {:ok, PersistedSnapshot.t()} | {:error, Ecto.Changeset.t()}
  def persist_snapshot(connection_id, %Snapshot{} = snapshot, payload_ref)
      when is_binary(payload_ref) and payload_ref != "" do
    changeset = snapshot_changeset(connection_id, snapshot, payload_ref)

    case Repo.insert(changeset,
           on_conflict: :nothing,
           conflict_target: [:connection_id, :manifest_hash]
         ) do
      {:ok, %PersistedSnapshot{id: nil}} ->
        {:ok,
         Repo.get_by!(PersistedSnapshot,
           connection_id: connection_id,
           manifest_hash: snapshot.manifest_hash
         )}

      result ->
        result
    end
  end

  @spec start_job(map(), keyword()) ::
          {:ok, %{job: Job.t(), created?: boolean()}} | {:error, term()}
  def start_job(attrs, opts \\ []) when is_map(attrs) and is_list(opts) do
    Repo.transaction(fn ->
      with {:ok, snapshot} <- job_snapshot(attrs),
           :ok <- validate_job_scope(attrs, snapshot),
           {:ok, idempotency_key} <- idempotency_key(attrs, snapshot, opts) do
        attrs =
          attrs
          |> Map.put(:idempotency_key, idempotency_key)
          |> Map.put(:status, :planning)

        {job, created?} = insert_job_once!(attrs)
        %{job: job, created?: created?}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec attach_preparation(Job.t() | pos_integer(), String.t(), map()) ::
          {:ok, Job.t()} | {:error, term()}
  def attach_preparation(job_or_id, snapshot_manifest_hash, locator)
      when is_binary(snapshot_manifest_hash) and is_map(locator) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           :ok <- ensure_planning_checkpoint(job),
           :ok <- ensure_doc_job(job),
           :ok <- ensure_job_snapshot(job, snapshot_manifest_hash),
           :ok <- validate_preparation_locator(locator),
           {:ok, job} <- attach_preparation_once(job, locator) do
        job
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec attach_plan(Job.t() | pos_integer(), Snapshot.t(), Plan.t(), String.t(), term()) ::
          {:ok,
           %{
             job: Job.t(),
             items: [PersistedItem.t()],
             assets: [PersistedAsset.t()],
             created?: boolean()
           }}
          | {:error, term()}
  def attach_plan(job_or_id, %Snapshot{} = snapshot, %Plan{} = plan, plan_ref, diff \\ nil)
      when is_binary(plan_ref) and plan_ref != "" do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           :ok <- ensure_planning_checkpoint(job),
           :ok <- ensure_job_snapshot(job, snapshot.manifest_hash),
           :ok <- ensure_plan_thread(job, plan),
           :ok <- ensure_doc_preparation(job) do
        plan_hash = PlanCodec.hash(plan)

        if is_nil(job.plan_ref) do
          attrs =
            %{
              plan_ref: plan_ref,
              plan_hash: plan_hash,
              plan_version: PlanCodec.version(),
              plan_summary: PlanCodec.summary(plan)
            }
            |> maybe_put_diff_summary(diff)

          job = job |> Ecto.Changeset.change(attrs) |> Repo.update!()
          {items, assets} = materialize_job_children(job, plan, diff)
          job = maybe_mark_ready(job, assets)
          %{job: job, items: items, assets: assets, created?: true}
        else
          with :ok <- ensure_same_plan(job, plan_hash) do
            %{
              job: job,
              items: job_items(job.id),
              assets: job_assets(job.id),
              created?: false
            }
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec upsert_mapping(map()) :: {:ok, PersistedMapping.t()} | {:error, Ecto.Changeset.t()}
  def upsert_mapping(attrs) when is_map(attrs) do
    replace_fields = [
      :snapshot_id,
      :target_ref,
      :last_imported_revision,
      :last_imported_source_hash,
      :last_imported_local_hash,
      :last_imported_at,
      :updated_at
    ]

    %PersistedMapping{}
    |> PersistedMapping.changeset(attrs)
    |> Repo.insert(
      on_conflict: {:replace, replace_fields},
      conflict_target: [:connection_id, :thread, :external_ref],
      returning: true
    )
  end

  @spec delete_mapping(pos_integer(), atom(), String.t()) :: {non_neg_integer(), nil | [term()]}
  def delete_mapping(connection_id, thread, external_ref) do
    PersistedMapping
    |> where(
      [mapping],
      mapping.connection_id == ^connection_id and mapping.thread == ^thread and
        mapping.external_ref == ^external_ref
    )
    |> Repo.delete_all()
  end

  @spec snapshot_changeset(pos_integer(), Snapshot.t(), String.t()) :: Ecto.Changeset.t()
  def snapshot_changeset(connection_id, %Snapshot{} = snapshot, payload_ref) do
    PersistedSnapshot.changeset(%PersistedSnapshot{}, %{
      connection_id: connection_id,
      revision: snapshot.revision,
      manifest_hash: snapshot.manifest_hash,
      manifest_hash_version: snapshot.manifest_hash_version,
      entry_hash_version: snapshot.entry_hash_version,
      normalization_version: snapshot.normalization_version,
      adapter_version: snapshot.adapter_version,
      checkpoint: snapshot.checkpoint || %{},
      fetched_at: snapshot.fetched_at,
      payload_ref: payload_ref,
      entry_count: length(snapshot.entries),
      entry_manifest: entry_manifest(snapshot),
      diagnostics: %{"items" => snapshot.diagnostics}
    })
  end

  @spec job_changeset(map()) :: Ecto.Changeset.t()
  def job_changeset(attrs) when is_map(attrs), do: Job.changeset(%Job{}, attrs)

  @spec asset_changesets(pos_integer(), Plan.t()) :: [Ecto.Changeset.t()]
  def asset_changesets(job_id, %Plan{} = plan) do
    Enum.map(plan.assets, &PersistedAsset.from_plan_asset(job_id, &1))
  end

  @spec job_items(pos_integer()) :: [PersistedItem.t()]
  def job_items(job_id) do
    PersistedItem
    |> where([item], item.job_id == ^job_id)
    |> order_by([item], asc: item.id)
    |> Repo.all()
  end

  @spec job_assets(pos_integer()) :: [PersistedAsset.t()]
  def job_assets(job_id) do
    PersistedAsset
    |> where([asset], asset.job_id == ^job_id)
    |> order_by([asset], asc: asset.id)
    |> Repo.all()
  end

  @spec job_ready?(Job.t(), [PersistedAsset.t()]) :: boolean()
  def job_ready?(%Job{status: status}, assets) when status in [:planning, :staging] do
    Enum.all?(assets, &(&1.status in [:ready, :failed, :cancelled]))
  end

  def job_ready?(%Job{}, _assets), do: false

  @spec job_statuses() :: [atom()]
  def job_statuses, do: Status.job()

  defp insert_job_once!(attrs) do
    changeset = job_changeset(attrs)

    case Repo.insert(changeset,
           on_conflict: :nothing,
           conflict_target: [:connection_id, :idempotency_key]
         ) do
      {:ok, %Job{id: nil}} ->
        job =
          Repo.get_by!(Job,
            connection_id: value(attrs, :connection_id),
            idempotency_key: value(attrs, :idempotency_key)
          )

        {job, false}

      {:ok, %Job{} = job} ->
        {job, true}

      {:error, changeset} ->
        Repo.rollback(changeset)
    end
  end

  defp materialize_job_children(job, plan, diff) do
    # Materialize queryable execution rows without turning one Plan into one SQL
    # round trip per child:
    #
    #     Plan.Item + source_deleted Diff.Item --\
    #                                           +--> validated rows --> insert batches
    #     Plan.Asset ---------------------------/
    #
    # Validation stays changeset-based. We intentionally do not use
    # `on_conflict: :nothing`: duplicate identities mean the Plan is invalid and
    # must roll back instead of silently dropping work.
    item_changesets =
      Enum.map(plan.items, &PersistedItem.from_plan_item(job.id, &1)) ++
        Enum.map(deleted_diff_items(diff), &PersistedItem.from_deleted_diff(job.id, &1))

    asset_changesets = Enum.map(plan.assets, &PersistedAsset.from_plan_asset(job.id, &1))

    items = insert_changesets(PersistedItem, item_changesets, :external_ref)
    assets = insert_changesets(PersistedAsset, asset_changesets, :asset_key)

    {items, assets}
  end

  defp insert_changesets(_schema, [], _order_field), do: []

  defp insert_changesets(schema, changesets, order_field) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    rows = Enum.map(changesets, &validated_insert_row(&1, now))

    positions =
      rows |> Enum.with_index() |> Map.new(fn {row, index} -> {row[order_field], index} end)

    schema
    |> insert_batches(rows)
    |> Enum.sort_by(&Map.fetch!(positions, Map.fetch!(&1, order_field)))
  end

  defp insert_batches(schema, rows) do
    rows
    |> Enum.chunk_every(@insert_batch_size)
    |> Enum.flat_map(fn batch ->
      {count, inserted} = Repo.insert_all(schema, batch, returning: true)

      if count != length(batch), do: Repo.rollback(:job_children_insert_incomplete)

      inserted
    end)
  end

  defp validated_insert_row(changeset, now) do
    Ecto.Changeset.apply_action!(changeset, :insert)

    changeset.changes
    |> Map.put(:inserted_at, now)
    |> Map.put(:updated_at, now)
  end

  defp maybe_mark_ready(%Job{status: :planning} = job, []) do
    job
    |> Job.transition_changeset(:ready)
    |> Repo.update!()
  end

  defp maybe_mark_ready(job, _assets), do: job

  defp deleted_diff_items(%{items: items}) when is_list(items) do
    Enum.filter(items, &(value(&1, :status) == :source_deleted))
  end

  defp deleted_diff_items(_diff), do: []

  defp job_snapshot(attrs) do
    snapshot_id = value(attrs, :snapshot_id)

    case Repo.get(PersistedSnapshot, snapshot_id) do
      %PersistedSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, :snapshot_not_found}
    end
  end

  defp validate_job_scope(attrs, snapshot) do
    connection_id = value(attrs, :connection_id)
    thread = value(attrs, :thread)

    cond do
      snapshot.connection_id != connection_id -> {:error, :snapshot_connection_mismatch}
      thread not in [:doc, :changelog, :post] -> {:error, :job_thread_invalid}
      true -> :ok
    end
  end

  defp idempotency_key(attrs, snapshot, opts) do
    IdempotencyKey.build(%{
      connection_id: snapshot.connection_id,
      snapshot_manifest_hash: snapshot.manifest_hash,
      thread: value(attrs, :thread),
      scope_ref: value(attrs, :scope_ref),
      effective_options: Keyword.get(opts, :effective_options, %{}),
      run_nonce: Keyword.get(opts, :run_nonce)
    })
  end

  defp maybe_put_diff_summary(attrs, %{summary: summary}) when is_map(summary) do
    encoded = Map.new(summary, fn {key, count} -> {to_string(key), count} end)
    Map.put(attrs, :diff_summary, encoded)
  end

  defp maybe_put_diff_summary(attrs, _diff), do: attrs

  defp lock_job(%Job{id: id}), do: lock_job(id)

  defp lock_job(id) when is_integer(id) do
    case Repo.one(from(job in Job, where: job.id == ^id, lock: "FOR UPDATE")) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, :job_not_found}
    end
  end

  defp lock_job(_job_or_id), do: {:error, :job_not_found}

  defp ensure_planning_checkpoint(%Job{status: status})
       when status in [:planning, :staging, :ready],
       do: :ok

  defp ensure_planning_checkpoint(job), do: {:error, {:job_not_plannable, job.status}}

  defp ensure_plan_thread(%Job{thread: thread}, %Plan{thread: thread}), do: :ok
  defp ensure_plan_thread(_job, _plan), do: {:error, :plan_thread_mismatch}

  defp ensure_doc_job(%Job{thread: :doc}), do: :ok
  defp ensure_doc_job(_job), do: {:error, :preparation_not_supported}

  defp ensure_doc_preparation(%Job{thread: :doc, preparation_ref: nil}),
    do: {:error, :doc_preparation_required}

  defp ensure_doc_preparation(_job), do: :ok

  defp ensure_job_snapshot(%Job{snapshot_id: snapshot_id}, manifest_hash) do
    case Repo.get(PersistedSnapshot, snapshot_id) do
      %PersistedSnapshot{manifest_hash: ^manifest_hash} -> :ok
      %PersistedSnapshot{} -> {:error, :job_snapshot_mismatch}
      nil -> {:error, :snapshot_not_found}
    end
  end

  defp ensure_same_plan(%Job{plan_hash: plan_hash}, plan_hash), do: :ok
  defp ensure_same_plan(_job, _plan_hash), do: {:error, :plan_checkpoint_mismatch}

  defp validate_preparation_locator(locator) do
    ref = value(locator, :preparation_ref)
    hash = value(locator, :preparation_hash)
    version = value(locator, :preparation_version)

    if is_binary(ref) and ref != "" and is_binary(hash) and byte_size(hash) == 64 and
         is_integer(version) and version > 0 do
      :ok
    else
      {:error, :invalid_preparation_locator}
    end
  end

  defp attach_preparation_once(%Job{preparation_ref: nil} = job, locator) do
    job
    |> Ecto.Changeset.change(%{
      preparation_ref: value(locator, :preparation_ref),
      preparation_hash: value(locator, :preparation_hash),
      preparation_version: value(locator, :preparation_version)
    })
    |> Repo.update()
  end

  defp attach_preparation_once(job, locator) do
    if job.preparation_hash == value(locator, :preparation_hash) do
      {:ok, job}
    else
      {:error, :preparation_checkpoint_mismatch}
    end
  end

  defp entry_manifest(snapshot) do
    entries =
      Enum.map(snapshot.entries, fn entry ->
        %{
          "externalRef" => entry.external_ref,
          "kind" => Atom.to_string(entry.kind),
          "path" => entry.path,
          "revision" => entry.revision,
          "contentHash" => entry.content_hash,
          "hashVersion" => entry.hash_version,
          "normalizationVersion" => entry.normalization_version
        }
      end)

    %{"entries" => entries}
  end

  defp value(attrs, key, default \\ nil),
    do: Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
end
