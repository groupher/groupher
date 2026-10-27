defmodule GroupherServer.Jobs.CMSOutboxCDN do
  @moduledoc """
  Delivers independent Article CDN effects on the public_cache queue.

      CMS Outbox -> dedicated queue -> CMS root Facade -> Article workflow
  """

  use Oban.Worker,
    queue: :public_cache,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one durable effect through the CMS root Facade.

  ## Examples

      CMSOutboxCDN.perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:article, job)
end
