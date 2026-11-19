defmodule GroupherServer.CMS.DocTree.Publication.Effects do
  @moduledoc """
  Captures status-only approval effects with the authoring transaction.

      Queue transition -> durable Outbox -> recipient notices
  """
  alias GroupherServer.{CMS, Jobs}
  alias CMS.Outbox.DedupeKey
  @doc "Enqueues one uniquely identified approval transition."
  def notify(queue, status, recipients, operation_ref)
      when is_binary(operation_ref) and is_list(recipients) do
    CMS.Outbox.send(%{
      event: "docs.approval_status",
      resource_type: "docs_queue",
      resource_id: queue.id,
      operation_ref: operation_ref,
      dedupe_key:
        DedupeKey.encode([
          queue.id,
          queue.queue_revision,
          queue.approval_policy_revision,
          queue.latest_approval_id,
          status,
          Enum.sort(Enum.uniq(recipients))
        ]),
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
