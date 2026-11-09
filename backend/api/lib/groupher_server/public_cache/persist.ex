defmodule GroupherServer.PublicCache.Persist do
  @moduledoc """
  Owns durable public-cache invalidation rows and delivery leases.

  The caller owns the domain transaction for `invalidate/4`; workflow code
  owns transaction scope for `insert/3`, lease claims, and finalization.

      domain transaction / purge worker
        -> PublicCache.Persist
        -> invalidation row and delivery lease
  """

  import Ecto.Query

  alias Ecto.Multi
  alias GroupherServer.{Jobs, Repo}
  alias GroupherServer.PublicCache
  alias PublicCache.{DeliveryConfig, Model.Invalidation}

  @doc """
  Adds an invalidation row and durable worker trigger to an Ecto.Multi.

  ## Examples

      PublicCache.Persist.invalidate(multi, :article_published, article, causation_id: command_id)
  """
  @spec invalidate(Ecto.Multi.t(), atom(), map() | struct(), keyword()) :: Ecto.Multi.t()
  def invalidate(%Multi{} = multi, type, aggregate, opts) do
    id = Ecto.UUID.generate()
    attrs = attrs(id, type, aggregate, opts)

    multi
    |> Multi.insert({:public_cache, id}, Invalidation.changeset(%Invalidation{}, attrs))
    |> Multi.run({:public_cache_trigger, id}, fn _repo, _changes ->
      enqueue(id)
    end)
  end

  @doc """
  Inserts one invalidation row in the caller-owned transaction.

  ## Examples

      PublicCache.Persist.insert(:article_published, article, causation_id: command_id)
  """
  @spec insert(atom(), map() | struct(), keyword()) ::
          {:ok, Invalidation.t()} | {:error, term()}
  def insert(type, aggregate, opts) do
    id = Ecto.UUID.generate()
    changeset = Invalidation.changeset(%Invalidation{}, attrs(id, type, aggregate, opts))
    Repo.insert(changeset)
  end

  @doc false
  @spec claim(Ecto.UUID.t(), String.t()) ::
          {:ok,
           Invalidation.t()
           | {:busy, pos_integer()}
           | :dead
           | :delivered
           | :missing}
          | {:error, term()}
  def claim(id, lock_ref) when is_binary(lock_ref) and lock_ref != "" do
    now = DateTime.utc_now(:second)

    case Repo.one(from(row in Invalidation, where: row.id == ^id, lock: "FOR UPDATE")) do
      nil ->
        {:ok, :missing}

      %Invalidation{status: :delivered} ->
        {:ok, :delivered}

      %Invalidation{status: :dead} ->
        {:ok, :dead}

      %Invalidation{status: :delivering} = row ->
        if lease_expired?(row, now) do
          {:ok, update_claim(row, lock_ref, now)}
        else
          {:ok, {:busy, remaining_lease_seconds(row, now)}}
        end

      %Invalidation{} = row ->
        {:ok, update_claim(row, lock_ref, now)}
    end
  end

  @doc false
  def mark_delivered(id, lock_ref, type)
      when is_binary(lock_ref) and lock_ref != "" and is_atom(type) do
    now = DateTime.utc_now(:second)

    {updated, _} =
      Repo.update_all(
        from(row in Invalidation,
          where: row.id == ^id and row.status == :delivering and row.locked_by == ^lock_ref
        ),
        set: [
          status: :delivered,
          delivered_at: now,
          locked_at: nil,
          locked_by: nil,
          updated_at: now
        ]
      )

    if updated == 1 do
      emit_telemetry(:delivered, %{invalidation_id: id, type: type})
      {:ok, :pass}
    else
      {:error, :stale_lock}
    end
  end

  @doc false
  def mark_failed(id, lock_ref, type, reason, dead?)
      when is_binary(lock_ref) and lock_ref != "" and is_atom(type) do
    mark_failed(id, lock_ref, type, reason, dead?, 0)
  end

  @doc false
  def mark_failed(id, lock_ref, type, reason, dead?, retry_after_seconds)
      when is_binary(lock_ref) and lock_ref != "" and is_atom(type) and
             is_integer(retry_after_seconds) and retry_after_seconds >= 0 do
    now = DateTime.utc_now(:second)
    status = if dead?, do: :dead, else: :pending
    available_at = if dead?, do: now, else: DateTime.add(now, retry_after_seconds, :second)

    {updated, _} =
      Repo.update_all(
        from(row in Invalidation,
          where: row.id == ^id and row.status == :delivering and row.locked_by == ^lock_ref
        ),
        set: [
          status: status,
          available_at: available_at,
          last_error_code: error_code(reason),
          last_error_at: now,
          locked_at: nil,
          locked_by: nil,
          updated_at: now
        ]
      )

    if updated == 1 do
      emit_telemetry(if(dead?, do: :dead, else: :failed), %{
        invalidation_id: id,
        type: type,
        error_code: error_code(reason)
      })

      {:ok, :pass}
    else
      {:error, :stale_lock}
    end
  end

  @doc """
  Returns durable purge backlog health for readiness and operations checks.

  ## Examples

      PublicCache.Persist.health()
  """
  @spec health() :: %{
          status: :ok | :degraded,
          pending: non_neg_integer(),
          delivering: non_neg_integer(),
          delivered: non_neg_integer(),
          dead: non_neg_integer(),
          oldest_pending_age_seconds: non_neg_integer() | nil,
          oldest_delivering_age_seconds: non_neg_integer() | nil,
          delivering_without_lease: non_neg_integer()
        }
  def health do
    now = DateTime.utc_now(:second)

    counts =
      from(row in Invalidation,
        group_by: row.status,
        select: {row.status, count(row.id)}
      )
      |> Repo.all()
      |> Map.new()

    oldest_pending =
      from(row in Invalidation,
        where: row.status == :pending,
        select: min(row.inserted_at)
      )
      |> Repo.one()

    oldest_delivering =
      from(row in Invalidation,
        where: row.status == :delivering,
        select: min(row.locked_at)
      )
      |> Repo.one()

    delivering_without_lease =
      from(row in Invalidation,
        where: row.status == :delivering and is_nil(row.locked_at),
        select: count(row.id)
      )
      |> Repo.one()

    dead = Map.get(counts, :dead, 0)
    oldest_pending_age_seconds = age_seconds(oldest_pending, now)
    oldest_delivering_age_seconds = age_seconds(oldest_delivering, now)

    degraded? =
      dead > 0 or
        delivering_without_lease > 0 or
        (oldest_pending_age_seconds || 0) > DeliveryConfig.pending_slo_seconds() or
        (oldest_delivering_age_seconds || 0) > DeliveryConfig.delivery_lease_seconds()

    %{
      status: if(degraded?, do: :degraded, else: :ok),
      pending: Map.get(counts, :pending, 0),
      delivering: Map.get(counts, :delivering, 0),
      delivered: Map.get(counts, :delivered, 0),
      dead: dead,
      oldest_pending_age_seconds: oldest_pending_age_seconds,
      oldest_delivering_age_seconds: oldest_delivering_age_seconds,
      delivering_without_lease: delivering_without_lease
    }
  end

  @doc false
  def enqueue(id) do
    if Jobs.config_skip_enqueue?() do
      {:ok, :pass}
    else
      id
      |> Jobs.public_cache_purge_job()
      |> Oban.insert()
    end
  end

  defp attrs(id, type, aggregate, opts) do
    payload = payload(aggregate)

    %{
      id: id,
      contract_version: 1,
      type: type,
      aggregate_type: Keyword.get(opts, :aggregate_type, aggregate_type(aggregate)),
      aggregate_id: to_string(Keyword.get(opts, :aggregate_id, aggregate_id(aggregate))),
      community_id: Map.get(payload, :community_id),
      payload: payload,
      causation_id: Keyword.fetch!(opts, :causation_id),
      status: :pending,
      attempts: 0,
      available_at: DateTime.utc_now(:second)
    }
  end

  defp payload(%{__struct__: _} = aggregate) do
    aggregate |> Map.from_struct() |> normalize_payload()
  end

  defp payload(%{} = aggregate), do: normalize_payload(aggregate)

  defp normalize_payload(aggregate) do
    community = aggregate |> get_either(:community, "community") |> community_slug()
    meta = get_either(aggregate, :meta, "meta") || %{}
    thread = Map.get(aggregate, :thread) || get_either(meta, :thread, "thread")

    %{
      community: community,
      community_id: get_either(aggregate, :community_id, "community_id"),
      thread: thread,
      inner_id: get_either(aggregate, :inner_id, "inner_id"),
      article_id: get_either(aggregate, :id, "id")
    }
  end

  defp get_either(map, atom_key, string_key) do
    Map.get(map, atom_key) || Map.get(map, string_key)
  end

  defp community_slug(community) when is_map(community) do
    get_either(community, :slug, "slug")
  end

  defp community_slug(community), do: community

  defp aggregate_type(%struct{}) do
    struct |> Module.split() |> List.last() |> Macro.underscore()
  end

  defp aggregate_type(_), do: "article"

  defp aggregate_id(aggregate) do
    Map.get(aggregate, :id) || Map.get(aggregate, "id") || Ecto.UUID.generate()
  end

  defp error_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code({reason, _}) when is_atom(reason), do: Atom.to_string(reason)
  defp error_code(_reason), do: "purge_failed"

  defp age_seconds(nil, _now), do: nil

  defp age_seconds(inserted_at, now) do
    max(DateTime.diff(now, inserted_at, :second), 0)
  end

  defp lease_expired?(%Invalidation{locked_at: nil}, _now), do: true

  defp lease_expired?(%Invalidation{locked_at: locked_at}, now) do
    DateTime.diff(now, locked_at, :second) >= DeliveryConfig.delivery_lease_seconds()
  end

  defp remaining_lease_seconds(%Invalidation{locked_at: locked_at}, now) do
    elapsed = max(DateTime.diff(now, locked_at, :second), 0)
    max(DeliveryConfig.delivery_lease_seconds() - elapsed, 1)
  end

  defp update_claim(row, lock_ref, now) do
    row
    |> Invalidation.changeset(%{
      status: :delivering,
      attempts: row.attempts + 1,
      locked_at: now,
      locked_by: lock_ref,
      updated_at: now
    })
    |> Repo.update!()
  end

  defp emit_telemetry(result, metadata) do
    :telemetry.execute(
      [:groupher, :public_cache, :purge],
      %{count: 1},
      Map.merge(metadata, %{result: result})
    )
  end
end
