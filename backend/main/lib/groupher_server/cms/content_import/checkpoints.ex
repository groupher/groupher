defmodule GroupherServer.CMS.ContentImport.Checkpoints do
  @moduledoc """
  Coordinates durable payload storage with bounded ContentImport database rows.

  PayloadStore writes happen before the database locator is committed. A store
  implementation should therefore support TTL cleanup for unreferenced refs.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Diff, Persistence, Plan, Snapshot}
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Snapshot, as: PersistedSnapshot
  alias GroupherServer.CMS.ContentImport.Plan.Codec, as: PlanCodec
  alias GroupherServer.CMS.ContentImport.Snapshot.Codec, as: SnapshotCodec
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation.Codec, as: PreparationCodec

  @spec persist_snapshot(pos_integer(), Snapshot.t(), module(), keyword()) ::
          {:ok, PersistedSnapshot.t()} | {:error, term()}
  def persist_snapshot(connection_id, %Snapshot{} = snapshot, store, opts \\ []) do
    with {:ok, payload} <- SnapshotCodec.dump(snapshot),
         {:ok, payload_ref} <-
           store.put(:snapshot, snapshot.manifest_hash, payload, store_opts(opts)),
         {:ok, persisted} <- Persistence.persist_snapshot(connection_id, snapshot, payload_ref) do
      {:ok, persisted}
    end
  end

  @spec load_snapshot(PersistedSnapshot.t(), module(), keyword()) ::
          {:ok, Snapshot.t()} | {:error, term()}
  def load_snapshot(%PersistedSnapshot{} = persisted, store, opts \\ []) do
    with {:ok, payload} <- store.get(persisted.payload_ref, store_opts(opts)),
         {:ok, snapshot} <- SnapshotCodec.load(payload),
         :ok <- validate_snapshot_row(snapshot, persisted) do
      {:ok, snapshot}
    end
  end

  @spec persist_preparation(Job.t() | pos_integer(), Preparation.t(), module(), keyword()) ::
          {:ok, Job.t()} | {:error, term()}
  def persist_preparation(job_or_id, %Preparation{} = preparation, store, opts \\ []) do
    with {:ok, payload} <- PreparationCodec.dump(preparation),
         {:ok, ref} <-
           store.put(
             :doc_preparation,
             preparation.preparation_hash,
             payload,
             store_opts(opts)
           ),
         {:ok, job} <-
           Persistence.attach_preparation(
             job_or_id,
             preparation.snapshot_manifest_hash,
             %{
               preparation_ref: ref,
               preparation_hash: preparation.preparation_hash,
               preparation_version: preparation.version
             }
           ) do
      {:ok, job}
    end
  end

  @spec load_preparation(map() | Job.t(), Snapshot.t(), module(), keyword()) ::
          {:ok, Preparation.t()} | {:error, term()}
  def load_preparation(locator, %Snapshot{} = snapshot, store, opts \\ []) do
    with {:ok, ref} <- required_locator(locator, :preparation_ref),
         {:ok, expected_hash} <- required_locator(locator, :preparation_hash),
         {:ok, payload} <- store.get(ref, store_opts(opts)),
         {:ok, preparation} <- PreparationCodec.load(payload, snapshot),
         true <- preparation.preparation_hash == expected_hash do
      {:ok, preparation}
    else
      false ->
        Diagnostic.error_result(
          "doc_preparation_locator_mismatch",
          "Doc Preparation does not match the persisted locator"
        )

      error ->
        error
    end
  end

  @spec start_job(map(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def start_job(attrs, opts \\ []), do: Persistence.start_job(attrs, opts)

  @spec persist_plan(Job.t() | pos_integer(), Snapshot.t(), Plan.t(), module(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def persist_plan(job_or_id, %Snapshot{} = snapshot, %Plan{} = plan, store, opts \\ []) do
    plan_hash = PlanCodec.hash(plan)

    diff =
      Diff.build(
        snapshot,
        Keyword.get(opts, :mappings, []),
        Keyword.get(opts, :local_hashes, %{})
      )

    with {:ok, payload} <- PlanCodec.dump(plan),
         {:ok, plan_ref} <- store.put(:plan, plan_hash, payload, store_opts(opts)) do
      Persistence.attach_plan(job_or_id, snapshot, plan, plan_ref, diff)
    end
  end

  @spec load_plan(Job.t(), module(), keyword()) :: {:ok, Plan.t()} | {:error, term()}
  def load_plan(%Job{} = job, store, opts \\ []) do
    with {:ok, ref} <- required_locator(job, :plan_ref),
         {:ok, expected_hash} <- required_locator(job, :plan_hash),
         {:ok, payload} <- store.get(ref, store_opts(opts)),
         {:ok, plan} <- PlanCodec.load(payload),
         true <- PlanCodec.hash(plan) == expected_hash,
         {:ok, plan} <- project_asset_state(plan, Persistence.job_assets(job.id)) do
      {:ok, plan}
    else
      false ->
        Diagnostic.error_result(
          "plan_payload_hash_mismatch",
          "Plan payload does not match the persisted hash"
        )

      error ->
        error
    end
  end

  defp project_asset_state(%Plan{assets: []} = plan, []), do: {:ok, plan}

  defp project_asset_state(%Plan{} = plan, persisted_assets) do
    rows = Map.new(persisted_assets, &{&1.asset_key, &1})
    expected_keys = MapSet.new(plan.assets, & &1.asset_key)

    if MapSet.new(Map.keys(rows)) == expected_keys do
      assets =
        Enum.map(plan.assets, fn asset ->
          row = Map.fetch!(rows, asset.asset_key)

          %{
            asset
            | status: plan_asset_status(row.status),
              content_hash: row.content_hash,
              staging_ref: row.staging_ref,
              mime_type: row.mime_type || asset.mime_type
          }
        end)

      {:ok, %{plan | assets: assets}}
    else
      Diagnostic.error_result(
        "plan_asset_checkpoint_mismatch",
        "Persisted Plan assets do not match Job.Asset rows"
      )
    end
  end

  defp plan_asset_status(:cancelled), do: :failed
  defp plan_asset_status(status), do: status

  defp validate_snapshot_row(snapshot, persisted) do
    if snapshot.manifest_hash == persisted.manifest_hash do
      :ok
    else
      Diagnostic.error_result(
        "snapshot_payload_locator_mismatch",
        "Snapshot payload does not match the persisted row"
      )
    end
  end

  defp required_locator(locator, key) do
    case Map.get(locator, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "content_import_#{key}_required",
          "ContentImport #{key} is required"
        )
    end
  end

  defp store_opts(opts), do: Keyword.get(opts, :store_opts, [])
end
