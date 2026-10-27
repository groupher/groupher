defmodule GroupherServer.Jobs.CMSOutboxSearch do
  @moduledoc """
  Delivers independent Article Search effects on the search queue.

      CMS Outbox -> dedicated queue -> CMS root Facade -> Article workflow
  """

  use Oban.Worker,
    queue: :search,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one durable effect through the CMS root Facade.

  ## Examples

      CMSOutboxSearch.perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:article, job)
end
