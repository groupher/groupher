defmodule GroupherServer.Jobs.CMSOutboxComment do
  @moduledoc """
  Routes committed Comment outbox wakeups to the CMS delivery workflow. The
  worker delegates event validation, leasing, retries, and effect execution to
  the durable outbox owner.

      Comment command commits outbox event
          -> Oban wakeup with event_id
          -> CMS.deliver_outbox(:comment, job)
          -> Comment outbox workflow and downstream effects
  """
  use Oban.Worker,
    queue: :cloudflare_purge,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Comment outbox job through the CMS outbox owner.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => 1}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:comment, job)
end
