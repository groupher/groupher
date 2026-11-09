defmodule GroupherServer.Jobs.CMSOutboxComment do
  @moduledoc """
  Oban entrypoint for Comment outbox delivery.

      caller -> GroupherServer.Jobs.CMSOutboxComment -> result
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
