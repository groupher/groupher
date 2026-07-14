defmodule GroupherServer.CMS.ContentImport.Orchestrator do
  @moduledoc """
  Owns recoverable Repo commands for import Jobs and staged assets.

  Platform fetch and ThreadAdapter work stay outside this module. Callers move
  the persisted Job through explicit transitions, claim bounded asset batches,
  and commit Mapping checkpoints only after a successful thread apply.
  """

  import Ecto.Changeset, only: [change: 2]
  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.CMS.ContentImport.{ApplyResult, Plan}
  alias GroupherServer.CMS.ContentImport.Persistence
  alias GroupherServer.CMS.ContentImport.Persistence.{Job, Snapshot}
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Asset
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item

  @default_claim_limit 20
  @default_lease_seconds 120

  @spec get_job_by_ref(pos_integer(), Ecto.UUID.t()) :: {:ok, Job.t()} | {:error, :not_found}
  def get_job_by_ref(community_id, hash_id) do
    case Repo.get_by(Job, community_id: community_id, hash_id: hash_id) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, :not_found}
    end
  end

  @spec transition_job(Job.t() | pos_integer(), atom(), map()) ::
          {:ok, Job.t()} | {:error, term()}
  def transition_job(job_or_id, next_status, attrs \\ %{}) when is_map(attrs) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           {:ok, job} <- update_job_transition(job, next_status, attrs) do
        job
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec claim_assets(Job.t() | pos_integer(), keyword()) ::
          {:ok, %{job: Job.t(), assets: [Asset.t()]}} | {:error, term()}
  def claim_assets(job_or_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, @default_claim_limit)
    now = Keyword.get(opts, :now, DateTime.utc_now())
    lease_seconds = Keyword.get(opts, :lease_seconds, @default_lease_seconds)

    with :ok <- validate_claim_options(limit, lease_seconds) do
      Repo.transaction(fn ->
        with {:ok, job} <- lock_job(job_or_id),
             {:ok, job} <- ensure_staging(job),
             {:ok, assets} <- claim_asset_rows(job, limit, now, lease_seconds),
             {:ok, job} <- refresh_progress(job, now) do
          %{job: job, assets: assets}
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @spec complete_asset(Asset.t() | pos_integer(), map(), keyword()) ::
          {:ok, %{job: Job.t(), asset: Asset.t()}} | {:error, term()}
  def complete_asset(asset_or_id, attrs, opts \\ []) when is_map(attrs) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    Repo.transaction(fn ->
      with {:ok, asset} <- lock_asset(asset_or_id),
           {:ok, job} <- lock_job(asset.job_id),
           :ok <- ensure_job_staging(job),
           {:ok, asset} <-
             asset
             |> Asset.transition_changeset(
               :ready,
               attrs
               |> Map.put_new(:staged_at, now)
               |> Map.put(:claimed_at, nil)
               |> Map.put(:lease_expires_at, nil)
             )
             |> Repo.update(),
           {:ok, job} <- refresh_progress(job, now) do
        %{job: job, asset: asset}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec fail_asset(Asset.t() | pos_integer(), map(), keyword()) ::
          {:ok, %{job: Job.t(), asset: Asset.t()}} | {:error, term()}
  def fail_asset(asset_or_id, error, opts \\ []) when is_map(error) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    Repo.transaction(fn ->
      with {:ok, asset} <- lock_asset(asset_or_id),
           {:ok, job} <- lock_job(asset.job_id),
           :ok <- ensure_job_staging(job),
           {:ok, asset} <-
             asset
             |> Asset.transition_changeset(:failed, %{
               last_error: error,
               claimed_at: nil,
               lease_expires_at: nil
             })
             |> Repo.update(),
           {:ok, job} <- refresh_progress(job, now) do
        %{job: job, asset: asset}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec cancel_job(Job.t() | pos_integer(), keyword()) :: {:ok, Job.t()} | {:error, term()}
  def cancel_job(job_or_id, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           {:ok, job} <- update_job_transition(job, :cancelled, %{}, now),
           :ok <- cancel_open_assets(job.id),
           {:ok, job} <- refresh_progress(job, now) do
        job
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec retry_job(Job.t() | pos_integer(), keyword()) :: {:ok, Job.t()} | {:error, term()}
  def retry_job(job_or_id, opts \\ []) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           {:ok, resume_at} <- retry_status(job, opts),
           {:ok, job} <-
             update_job_transition(job, resume_at, %{error_code: nil, error_message: nil}) do
        job
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec resolve_item(Job.t() | pos_integer(), String.t(), Item.resolution(), boolean()) ::
          {:ok, Item.t()} | {:error, term()}
  def resolve_item(job_or_id, external_ref, resolution, selected \\ true)
      when is_binary(external_ref) and is_boolean(selected) do
    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           :ok <- ensure_item_resolvable(job),
           {:ok, item} <- lock_item(job.id, external_ref),
           {:ok, item} <-
             item
             |> Item.resolution_changeset(resolution, selected)
             |> Repo.update() do
        item
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec begin_apply(Job.t() | pos_integer()) :: {:ok, Job.t()} | {:error, term()}
  def begin_apply(job_or_id), do: transition_job(job_or_id, :applying)

  @spec fail_job(Job.t() | pos_integer(), String.t(), String.t()) ::
          {:ok, Job.t()} | {:error, term()}
  def fail_job(job_or_id, code, message) when is_binary(code) and is_binary(message) do
    transition_job(job_or_id, :failed, %{error_code: code, error_message: message})
  end

  @doc """
  Applies thread writes, Mapping checkpoints, source-deletion resolutions, and
  Job completion in one database transaction.

  The Job must already be in `applying`; callers may publish external assets
  before this boundary using stable idempotency keys.
  """
  @spec apply_job(
          Job.t() | pos_integer(),
          Snapshot.t(),
          Plan.t(),
          module(),
          term(),
          map() | (ApplyResult.t() -> map() | {:ok, map()} | {:error, term()}),
          keyword()
        ) :: {:ok, map()} | {:error, term()}
  def apply_job(
        job_or_id,
        %Snapshot{} = snapshot,
        %Plan{} = plan,
        thread_adapter,
        actor,
        local_hashes_or_resolver,
        opts \\ []
      )
      when is_atom(thread_adapter) and is_list(opts) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    Repo.transaction(fn ->
      with {:ok, job} <- lock_job(job_or_id),
           :ok <- ensure_applying(job),
           :ok <- ensure_snapshot_scope(job, snapshot),
           {:ok, items} <- lock_job_items(job.id),
           :ok <- validate_item_resolutions(items, opts),
           apply_opts <- Keyword.put(opts, :item_resolutions, item_resolution_map(items)),
           {:ok, result} <- thread_adapter.apply_in_transaction(plan, actor, apply_opts),
           {:ok, local_hashes} <- resolve_local_hashes(local_hashes_or_resolver, result),
           {:ok, completed} <-
             complete_apply_in_transaction(job, snapshot, plan, result, local_hashes, now),
           :ok <- apply_deleted_resolutions(job, items, opts) do
        Map.put(completed, :result, result)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp claim_asset_rows(job, limit, now, lease_seconds) do
    expired = now

    assets =
      Asset
      |> where([asset], asset.job_id == ^job.id)
      |> where(
        [asset],
        asset.status in [:pending, :failed] or
          (asset.status == :staging and asset.lease_expires_at < ^expired)
      )
      |> order_by([asset], asc: asset.id)
      |> limit(^limit)
      |> lock("FOR UPDATE SKIP LOCKED")
      |> Repo.all()

    lease_expires_at = DateTime.add(now, lease_seconds, :second)

    assets
    |> Enum.reduce_while({:ok, []}, fn asset, {:ok, claimed} ->
      attrs = %{
        status: :staging,
        attempts: asset.attempts + 1,
        claimed_at: now,
        lease_expires_at: lease_expires_at,
        last_error: %{}
      }

      changeset =
        if asset.status == :staging,
          do: Asset.changeset(asset, attrs),
          else: Asset.transition_changeset(asset, :staging, attrs)

      case Repo.update(changeset) do
        {:ok, next_asset} -> {:cont, {:ok, [next_asset | claimed]}}
        {:error, changeset} -> {:halt, {:error, changeset}}
      end
    end)
    |> case do
      {:ok, claimed} -> {:ok, Enum.reverse(claimed)}
      error -> error
    end
  end

  defp ensure_staging(%Job{status: :staging} = job), do: {:ok, job}

  defp ensure_staging(%Job{status: status} = job) when status in [:planning, :failed] do
    update_job_transition(job, :staging, %{})
  end

  defp ensure_staging(%Job{status: :ready} = job) do
    if Repo.exists?(
         from(asset in Asset, where: asset.job_id == ^job.id and asset.status == :failed)
       ),
       do: update_job_transition(job, :staging, %{}),
       else: {:error, {:job_has_no_failed_assets, job.id}}
  end

  defp ensure_staging(job), do: {:error, {:job_not_stageable, job.status}}

  defp ensure_job_staging(%Job{status: :staging}), do: :ok
  defp ensure_job_staging(job), do: {:error, {:job_not_staging, job.status}}

  defp refresh_progress(job, now) do
    counts = asset_counts(job.id)
    total = Enum.sum(Map.values(counts))
    terminal = counts.ready + counts.failed + counts.cancelled

    progress =
      Map.merge(job.progress || %{}, %{
        "assets" => Map.put(counts, :total, total),
        "assetTerminalCount" => terminal
      })

    with {:ok, job} <- job |> change(%{progress: progress}) |> Repo.update() do
      if job.status in [:planning, :staging] and terminal == total do
        update_job_transition(
          job,
          :ready,
          %{progress: progress, error_code: nil, error_message: nil},
          now
        )
      else
        {:ok, job}
      end
    end
  end

  defp asset_counts(job_id) do
    rows =
      Asset
      |> where([asset], asset.job_id == ^job_id)
      |> group_by([asset], asset.status)
      |> select([asset], {asset.status, count(asset.id)})
      |> Repo.all()
      |> Map.new()

    %{
      pending: Map.get(rows, :pending, 0),
      staging: Map.get(rows, :staging, 0),
      ready: Map.get(rows, :ready, 0),
      failed: Map.get(rows, :failed, 0),
      cancelled: Map.get(rows, :cancelled, 0)
    }
  end

  defp cancel_open_assets(job_id) do
    assets =
      Asset
      |> where([asset], asset.job_id == ^job_id)
      |> where([asset], asset.status in [:pending, :staging, :failed])
      |> lock("FOR UPDATE")
      |> Repo.all()

    Enum.reduce_while(assets, :ok, fn asset, :ok ->
      case asset
           |> Asset.transition_changeset(:cancelled, %{
             claimed_at: nil,
             lease_expires_at: nil
           })
           |> Repo.update() do
        {:ok, _asset} -> {:cont, :ok}
        {:error, changeset} -> {:halt, {:error, changeset}}
      end
    end)
  end

  defp retry_status(%Job{status: :failed} = job, opts) do
    requested = Keyword.get(opts, :resume_at)

    status =
      requested ||
        cond do
          is_nil(job.snapshot_id) -> :loading
          is_nil(job.plan_ref) -> :planning
          Repo.exists?(from(asset in Asset, where: asset.job_id == ^job.id)) -> :staging
          true -> :planning
        end

    if status in [:loading, :planning, :staging],
      do: {:ok, status},
      else: {:error, {:invalid_retry_status, status}}
  end

  defp retry_status(job, _opts), do: {:error, {:job_not_retryable, job.status}}

  defp complete_apply_in_transaction(job, snapshot, plan, result, local_hashes, now) do
    with :ok <- ensure_applying(job),
         :ok <- ensure_snapshot_scope(job, snapshot),
         {:ok, mappings} <-
           persist_apply_mappings(job, snapshot, plan, result, local_hashes, now),
         {:ok, job} <-
           update_job_transition(
             job,
             :completed,
             %{progress: apply_progress(job.progress, result)},
             now
           ) do
      {:ok, %{job: job, mappings: mappings}}
    end
  end

  defp ensure_item_resolvable(%Job{status: status}) when status in [:ready, :failed], do: :ok
  defp ensure_item_resolvable(job), do: {:error, {:job_items_not_resolvable, job.status}}

  defp lock_job_items(job_id) do
    items =
      Item
      |> where([item], item.job_id == ^job_id)
      |> order_by([item], asc: item.id)
      |> lock("FOR UPDATE")
      |> Repo.all()

    {:ok, items}
  end

  defp lock_item(job_id, external_ref) do
    case Repo.one(
           from(item in Item,
             where: item.job_id == ^job_id and item.external_ref == ^external_ref,
             lock: "FOR UPDATE"
           )
         ) do
      %Item{} = item -> {:ok, item}
      nil -> {:error, :job_item_not_found}
    end
  end

  defp validate_item_resolutions(items, opts) do
    archive_handler = Keyword.get(opts, :archive_handler)

    Enum.reduce_while(items, :ok, fn item, :ok ->
      reason =
        cond do
          item.action == :conflict and is_nil(item.resolution) ->
            {:item_resolution_required, item.external_ref}

          item.resolution == :manual ->
            {:manual_resolution_incomplete, item.external_ref}

          item.action == :source_deleted and is_nil(item.resolution) ->
            {:item_resolution_required, item.external_ref}

          item.resolution == :archive and not is_function(archive_handler, 1) ->
            {:archive_handler_required, item.external_ref}

          true ->
            nil
        end

      if is_nil(reason), do: {:cont, :ok}, else: {:halt, {:error, reason}}
    end)
  end

  defp item_resolution_map(items) do
    Map.new(items, fn item ->
      resolution = if item.selected, do: item.resolution, else: :skip
      {item.external_ref, resolution}
    end)
  end

  defp resolve_local_hashes(local_hashes, _result) when is_map(local_hashes),
    do: {:ok, local_hashes}

  defp resolve_local_hashes(resolver, result) when is_function(resolver, 1) do
    case resolver.(result) do
      {:ok, local_hashes} when is_map(local_hashes) -> {:ok, local_hashes}
      local_hashes when is_map(local_hashes) -> {:ok, local_hashes}
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_local_hash_resolver_result}
    end
  end

  defp resolve_local_hashes(_resolver, _result), do: {:error, :invalid_local_hash_resolver}

  defp apply_deleted_resolutions(job, items, opts) do
    archive_handler = Keyword.get(opts, :archive_handler)

    items
    |> Enum.filter(&(&1.action == :source_deleted))
    |> Enum.reduce_while(:ok, fn item, :ok ->
      case item.resolution do
        :keep ->
          {:cont, :ok}

        :unlink ->
          Persistence.delete_mapping(job.connection_id, job.thread, item.external_ref)
          {:cont, :ok}

        :archive ->
          case archive_handler.(item) do
            :ok ->
              Persistence.delete_mapping(job.connection_id, job.thread, item.external_ref)
              {:cont, :ok}

            {:ok, _result} ->
              Persistence.delete_mapping(job.connection_id, job.thread, item.external_ref)
              {:cont, :ok}

            {:error, reason} ->
              {:halt, {:error, reason}}

            _ ->
              {:halt, {:error, {:invalid_archive_handler_result, item.external_ref}}}
          end

        resolution ->
          {:halt, {:error, {:invalid_source_deleted_resolution, item.external_ref, resolution}}}
      end
    end)
  end

  defp persist_apply_mappings(job, snapshot, plan, result, local_hashes, now) do
    items_by_ref = Map.new(plan.items, &{&1.external_ref, &1})

    result.items
    |> Enum.reject(&(&1.status == :skipped))
    |> Enum.reduce_while({:ok, []}, fn applied, {:ok, mappings} ->
      with {:ok, item} <- Map.fetch(items_by_ref, applied.external_ref),
           :ok <- ensure_applied_target(item, applied),
           {:ok, local_hash} <- fetch_local_hash(local_hashes, applied.target_ref),
           {:ok, mapping} <-
             Persistence.upsert_mapping(%{
               connection_id: job.connection_id,
               snapshot_id: snapshot.id,
               external_ref: item.external_ref,
               thread: plan.thread,
               target_ref: applied.target_ref,
               last_imported_revision: item.source_revision,
               last_imported_source_hash: item.source_hash,
               last_imported_local_hash: local_hash,
               last_imported_at: now
             }) do
        {:cont, {:ok, [mapping | mappings]}}
      else
        :error -> {:halt, {:error, {:apply_item_missing, applied.external_ref}}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, mappings} -> {:ok, Enum.reverse(mappings)}
      error -> error
    end
  end

  defp fetch_local_hash(local_hashes, target_ref) do
    case Map.fetch(local_hashes, target_ref) do
      {:ok, value} when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:local_hash_missing, target_ref}}
    end
  end

  defp ensure_applied_target(item, applied) do
    if item.target_ref == applied.target_ref,
      do: :ok,
      else: {:error, {:apply_target_mismatch, applied.external_ref}}
  end

  defp ensure_snapshot_scope(
         %Job{snapshot_id: snapshot_id, connection_id: connection_id},
         %Snapshot{
           id: snapshot_id,
           connection_id: connection_id
         }
       ),
       do: :ok

  defp ensure_snapshot_scope(_job, _snapshot), do: {:error, :snapshot_scope_mismatch}

  defp ensure_applying(%Job{status: :applying}), do: :ok
  defp ensure_applying(job), do: {:error, {:job_not_applying, job.status}}

  defp apply_progress(progress, result) do
    counts = Enum.frequencies_by(result.items, & &1.status)

    Map.merge(progress || %{}, %{
      "applied" => %{
        "created" => Map.get(counts, :created, 0),
        "updated" => Map.get(counts, :updated, 0),
        "skipped" => Map.get(counts, :skipped, 0)
      }
    })
  end

  defp update_job_transition(job, next_status, attrs, now \\ DateTime.utc_now()) do
    job
    |> Job.transition_changeset(next_status, now)
    |> change(attrs)
    |> Repo.update()
  end

  defp lock_job(%Job{id: id}), do: lock_job(id)

  defp lock_job(id) when is_integer(id) do
    case Repo.one(from(job in Job, where: job.id == ^id, lock: "FOR UPDATE")) do
      %Job{} = job -> {:ok, job}
      nil -> {:error, :job_not_found}
    end
  end

  defp lock_job(_job_or_id), do: {:error, :job_not_found}

  defp lock_asset(%Asset{id: id}), do: lock_asset(id)

  defp lock_asset(id) when is_integer(id) do
    case Repo.one(from(asset in Asset, where: asset.id == ^id, lock: "FOR UPDATE")) do
      %Asset{} = asset -> {:ok, asset}
      nil -> {:error, :asset_not_found}
    end
  end

  defp lock_asset(_asset_or_id), do: {:error, :asset_not_found}

  defp validate_claim_options(limit, lease_seconds)
       when is_integer(limit) and limit > 0 and limit <= 100 and is_integer(lease_seconds) and
              lease_seconds > 0 and lease_seconds <= 3_600,
       do: :ok

  defp validate_claim_options(_limit, _lease_seconds), do: {:error, :invalid_claim_options}
end
