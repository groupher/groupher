defmodule GroupherServer.PublicCache.PurgeWorker do
  @moduledoc """
  Durably delivers one PublicCache invalidation to Cloudflare.

  Business position:

      Oban job -> claim invalidation -> resolve tags -> purge -> delivered/dead
  """

  use Oban.Worker,
    queue: :public_cache,
    max_attempts: GroupherServer.PublicCache.Policy.max_attempts(),
    unique: [period: 86_400, keys: [:invalidation_id], states: :incomplete]

  require Logger

  alias GroupherServer.{PublicCache, Repo}
  alias PublicCache.{Cloudflare, Model.Invalidation, Policy, Scope}

  @impl Oban.Worker
  def backoff(%Oban.Job{attempt: attempt}) do
    base = Policy.retry_base_delay_seconds()
    exponential = round(base * :math.pow(2, max(attempt - 1, 0)))
    jitter = :rand.uniform(max(div(exponential, 4), 1)) - 1
    min(exponential + jitter, Policy.max_retry_delay_seconds())
  end

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"invalidation_id" => id}} = job) do
    lock_ref = "#{node()}:#{job.id}:#{job.attempt}:#{Ecto.UUID.generate()}"

    case PublicCache.claim(id, lock_ref) do
      {:ok, %Invalidation{} = invalidation} ->
        if invalidation.contract_version == 1 do
          deliver(invalidation, job, lock_ref)
        else
          finalize_failed(invalidation, lock_ref, {:invalid_contract, :version}, true)
          {:ok, :pass}
        end

      {:busy, retry_after_seconds} ->
        {:snooze, retry_after_seconds}

      status when status in [:dead, :delivered, :missing] ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp deliver(%Invalidation{} = invalidation, job, lock_ref) do
    with {:ok, tags} <- Scope.tags(invalidation.type, invalidation.payload),
         {:ok, _} <- Cloudflare.purge(tags) do
      finalize_delivered(invalidation, lock_ref)
      {:ok, :pass}
    else
      {:error, reason} = error ->
        dead? = terminal_failure?(reason) or job.attempt >= job.max_attempts
        finalize_failed(invalidation, lock_ref, reason, dead?)
        if dead?, do: {:ok, :pass}, else: error
    end
  rescue
    exception ->
      Logger.error("public cache purge worker failed: #{inspect(exception)}")

      finalize_failed(
        invalidation,
        lock_ref,
        :worker_exception,
        job.attempt >= job.max_attempts
      )

      if job.attempt >= job.max_attempts, do: {:ok, :pass}, else: {:error, exception}
  end

  defp finalize_delivered(invalidation, lock_ref) do
    case PublicCache.mark_delivered(invalidation.id, lock_ref, invalidation.type) do
      {:ok, _} -> {:ok, :pass}
      {:error, :stale_lock} -> {:ok, :pass}
    end
  end

  defp finalize_failed(invalidation, lock_ref, reason, dead?) do
    case PublicCache.mark_failed(invalidation.id, lock_ref, invalidation.type, reason, dead?) do
      {:ok, _} -> {:ok, :pass}
      {:error, :stale_lock} -> {:ok, :pass}
    end
  end

  defp terminal_failure?({:error, reason}), do: terminal_failure?(reason)

  defp terminal_failure?({:cloudflare_rejected, status}) when status in [400, 401, 403, 422] do
    true
  end

  defp terminal_failure?(reason)
       when reason in [
              :cloudflare_not_configured,
              :unknown_invalidation_type,
              :invalid_cache_scope,
              :invalid_cache_tag,
              :too_many_cache_tags
            ] do
    true
  end

  defp terminal_failure?({:invalid_contract, _}), do: true
  defp terminal_failure?(_reason), do: false

  @doc false
  def reload(id), do: Repo.get(Invalidation, id)
end
