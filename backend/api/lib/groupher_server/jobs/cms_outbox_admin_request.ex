defmodule GroupherServer.Jobs.CMSOutboxAdminRequest do
  @moduledoc """
  Delivers durable Community Admin request notices through Messaging.

      Outbox event -> Messaging.notify -> Dedup + Notice + mailbox projection
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Admin request notice through its CMS workflow.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:admin_request, job)
end
