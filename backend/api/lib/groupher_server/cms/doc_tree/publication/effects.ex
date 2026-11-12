defmodule GroupherServer.CMS.DocTree.Publication.Effects do
  @moduledoc """
  Captures status-only approval effects with the authoring transaction.

      Queue transition -> durable Outbox -> recipient notices
  """
  alias GroupherServer.{CMS, Jobs}
  @doc "Enqueues one uniquely identified approval transition."
  def notify(queue, status, recipients) do
    CMS.Outbox.send(%{
      event: "docs.approval_status",
      resource_type: "docs_queue",
      resource_id: queue.id,
      identity:
        {:workflow,
         "#{queue.id}:#{queue.queue_revision}:#{queue.approval_policy_revision}:#{queue.latest_approval_id}:#{status}"},
      worker: Jobs.CMSOutboxDocs,
      data: %{
        community_id: queue.community_id,
        status: status,
        queue_revision: queue.queue_revision,
        recipients: recipients
      }
    })
  end
end
