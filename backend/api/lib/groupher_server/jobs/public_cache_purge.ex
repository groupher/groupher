defmodule GroupherServer.Jobs.PublicCachePurge do
  @moduledoc """
  Oban entrypoint for durable PublicCache invalidation delivery.

      Oban
        -> Jobs.PublicCachePurge
        -> PublicCache facade
        -> Workflow / Effects / provider
  """

  use Oban.Worker,
    queue: :cloudflare_purge,
    max_attempts: GroupherServer.PublicCache.max_delivery_attempts(),
    unique: [period: 86_400, keys: [:invalidation_id], states: :incomplete]

  alias GroupherServer.PublicCache

  @doc """
  Calculates the next PublicCache retry delay from the Oban attempt number.

  ## Examples

      backoff(%Oban.Job{attempt: 1})
  """
  @impl Oban.Worker
  def backoff(%Oban.Job{attempt: attempt}), do: PublicCache.delivery_retry_delay(attempt)

  @doc """
  Delivers one durable PublicCache invalidation and returns snooze/retry signals to Oban.

  ## Examples

      perform(%Oban.Job{args: %{"invalidation_id" => Ecto.UUID.generate()}})
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"invalidation_id" => id}} = job) do
    lock_ref = "#{node()}:#{job.id}:#{job.attempt}:#{Ecto.UUID.generate()}"

    case PublicCache.deliver(id, lock_ref, job.attempt, job.max_attempts) do
      {:ok, {:snooze, retry_after_seconds}} -> {:snooze, retry_after_seconds}
      {:ok, :pass} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
