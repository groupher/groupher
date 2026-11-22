defmodule GroupherServer.Jobs.CMSOutboxDocs do
  @moduledoc """
  Delivers committed Docs approval status notices.

      Oban wakeup -> leased CMS Outbox -> idempotent recipient status
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers through the CMS Outbox workflow boundary.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:docs, job)
end
