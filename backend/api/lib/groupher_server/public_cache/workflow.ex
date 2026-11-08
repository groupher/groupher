defmodule GroupherServer.PublicCache.Workflow do
  @moduledoc """
  Owns transaction scope for PublicCache delivery and recovery steps.

  Persist supplies row primitives; this module supplies the transaction around
  insertion, lease fencing, and terminal delivery state changes.

      PublicCache request / PurgeWorker
        -> Workflow transaction
        -> Persist row primitive
        -> commit or retry
  """

  require Logger

  alias GroupherServer.{PublicCache, Repo}
  alias PublicCache.{DeliveryConfig, Effects, Model.Invalidation, Persist}

  @doc """
  Records an invalidation and enqueues delivery in one transaction.

  ## Examples

      PublicCache.Workflow.invalidate_now(:article_published, article, causation_id: command_id)
  """
  @spec invalidate_now(atom(), map() | struct(), keyword()) ::
          {:ok, Invalidation.t()} | {:error, term()}
  def invalidate_now(type, aggregate, opts) do
    Repo.transaction(fn ->
      with {:ok, invalidation} <- Persist.insert(type, aggregate, opts),
           {:ok, _job} <- Persist.enqueue(invalidation.id) do
        invalidation
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Claims a pending or expired delivery lease with a fencing token.

  ## Examples

      PublicCache.Workflow.claim(invalidation_id, lock_ref)
  """
  @spec claim(Ecto.UUID.t(), String.t()) ::
          {:ok,
           Invalidation.t()
           | {:busy, pos_integer()}
           | :dead
           | :delivered
           | :missing}
          | {:error, term()}
  def claim(id, lock_ref) do
    Repo.transaction(fn -> Persist.claim(id, lock_ref) end)
    |> unwrap_transaction()
  end

  @doc false
  def mark_delivered(id, lock_ref, type) do
    Repo.transaction(fn -> Persist.mark_delivered(id, lock_ref, type) end)
    |> unwrap_transaction()
  end

  @doc false
  def mark_failed(id, lock_ref, type, reason, dead?) do
    mark_failed(id, lock_ref, type, reason, dead?, 0)
  end

  @doc false
  def mark_failed(id, lock_ref, type, reason, dead?, retry_after_seconds) do
    Repo.transaction(fn ->
      Persist.mark_failed(id, lock_ref, type, reason, dead?, retry_after_seconds)
    end)
    |> unwrap_transaction()
  end

  @doc """
  Delivers one committed invalidation and records its terminal or retryable result.

  ## Examples

      iex> GroupherServer.PublicCache.Workflow.deliver(...)
  """
  @spec deliver(Ecto.UUID.t(), String.t(), pos_integer(), pos_integer()) ::
          {:ok, :pass | {:snooze, pos_integer()}} | {:error, term()}
  def deliver(id, lock_ref, attempt, max_attempts) do
    case claim(id, lock_ref) do
      {:ok, %Invalidation{contract_version: 1} = invalidation} ->
        deliver_claimed(invalidation, lock_ref, attempt, max_attempts)

      {:ok, %Invalidation{} = invalidation} ->
        finalize_failure(invalidation, lock_ref, {:invalid_contract, :version}, true)

      {:ok, {:busy, retry_after_seconds}} ->
        {:ok, {:snooze, retry_after_seconds}}

      {:ok, status} when status in [:dead, :delivered, :missing] ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  rescue
    exception ->
      Logger.error("public cache delivery failed: #{inspect(exception)}")
      {:error, exception}
  end

  @doc """
  Returns the retry delay for a delivery attempt.

  ## Examples

      iex> GroupherServer.PublicCache.Workflow.delivery_retry_delay(...)
  """
  @spec delivery_retry_delay(pos_integer()) :: pos_integer()
  def delivery_retry_delay(attempt) do
    base = DeliveryConfig.retry_base_delay_seconds()
    exponential = round(base * :math.pow(2, max(attempt - 1, 0)))
    jitter = :rand.uniform(max(div(exponential, 4), 1)) - 1
    min(exponential + jitter, DeliveryConfig.max_retry_delay_seconds())
  end

  defp deliver_claimed(invalidation, lock_ref, attempt, max_attempts) do
    case Effects.deliver(invalidation) do
      {:ok, :pass} ->
        finalize_delivery(invalidation, lock_ref)

      {:error, reason} = error ->
        case reason do
          {:cloudflare_rate_limited, seconds} when seconds in 1..86_400 ->
            finalize_rate_limited_error(
              invalidation,
              lock_ref,
              error,
              reason,
              seconds,
              attempt,
              max_attempts
            )

          _ ->
            finalize_delivery_error(invalidation, lock_ref, error, reason, attempt, max_attempts)
        end
    end
  end

  defp finalize_delivery(invalidation, lock_ref) do
    case mark_delivered(invalidation.id, lock_ref, invalidation.type) do
      {:ok, _} -> {:ok, :pass}
      {:error, :stale_lock} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp finalize_delivery_error(invalidation, lock_ref, error, reason, attempt, max_attempts) do
    dead? = terminal_failure?(reason) or attempt >= max_attempts

    case mark_failed(invalidation.id, lock_ref, invalidation.type, reason, dead?) do
      {:ok, _} -> retry_or_complete(error, dead?)
      {:error, :stale_lock} -> {:ok, :pass}
      {:error, finalize_reason} -> {:error, finalize_reason}
    end
  end

  defp finalize_rate_limited_error(
         invalidation,
         lock_ref,
         error,
         reason,
         retry_after_seconds,
         attempt,
         max_attempts
       ) do
    dead? = attempt >= max_attempts

    case mark_failed(
           invalidation.id,
           lock_ref,
           invalidation.type,
           reason,
           dead?,
           retry_after_seconds
         ) do
      {:ok, _} when dead? -> retry_or_complete(error, true)
      {:ok, _} -> {:ok, {:snooze, retry_after_seconds}}
      {:error, :stale_lock} -> {:ok, :pass}
      {:error, finalize_reason} -> {:error, finalize_reason}
    end
  end

  defp retry_or_complete(_error, true), do: {:ok, :pass}
  defp retry_or_complete(error, false), do: error

  defp finalize_failure(invalidation, lock_ref, reason, dead?) do
    case mark_failed(invalidation.id, lock_ref, invalidation.type, reason, dead?) do
      {:ok, _} -> {:ok, :pass}
      {:error, :stale_lock} -> {:ok, :pass}
      {:error, finalize_reason} -> {:error, finalize_reason}
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

  defp unwrap_transaction({:ok, {:ok, result}}), do: {:ok, result}
  defp unwrap_transaction({:ok, {:error, reason}}), do: {:error, reason}
  defp unwrap_transaction({:error, reason}), do: {:error, reason}
end
