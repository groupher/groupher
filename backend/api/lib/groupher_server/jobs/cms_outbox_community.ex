defmodule GroupherServer.Jobs.CMSOutboxCommunity do
  @moduledoc """
  Routes Community and DocTree outbox wakeups to their CMS-owned delivery
  workflows. Durable event lookup, state transitions, and retry decisions are
  handled by CMS rather than this worker.

      Community / DocTree transaction commits event
          -> Oban wakeup with event_id
          -> CMS.deliver_outbox(:community, job)
          -> Community outbox workflow
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Community/DocTree outbox job through the CMS outbox owner.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => 1}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:community, job)
end
