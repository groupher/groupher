defmodule GroupherServer.Jobs.CMSOutboxInteraction do
  @moduledoc """
  Routes committed Interaction outbox wakeups to the CMS delivery workflow.
  The worker is a typed queue boundary; event leasing and durable effect
  handling stay within CMS.

      Interaction command commits event
          -> Oban wakeup with event_id
          -> CMS.deliver_outbox(:interaction, job)
          -> Interaction outbox workflow and downstream effects
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Interaction outbox job through the CMS outbox owner.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => 1}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:interaction, job)
end
